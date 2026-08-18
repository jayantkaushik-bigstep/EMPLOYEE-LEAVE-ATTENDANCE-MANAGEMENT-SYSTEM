import mongoose, { Types } from "mongoose";
import { Request } from "express";
import { AppError } from "../errors/app-error";
import { Employee, IEmployee } from "../models/employee.model";
import { LeaveType } from "../models/leave-type.model";
import { LeaveBalance } from "../models/leave-balance.model";
import { ILeaveRequest } from "../models/leave-request.model";
import {
  createLeaveRequest,
  findLeaveRequestById,
  findLeaveRequests,
  findOverlappingLeaves,
  updateLeaveRequest,
} from "../repositories/leave-request.repository";
import { findHolidaysInRange } from "../repositories/holiday.repository";
import {
  calculateLeaveDays,
  calculateNoticeDays,
  isValidDateString,
} from "../utils/leave-calculator.util";
import { recordAuditLog } from "./audit-log.service";
import { notificationService } from "./notification.service";
import { JwtPayload } from "../types/auth.types";

/**
 * Execute operation in a transaction when replica set is active,
 * or safely execute without transaction on standalone instances.
 */
const runInTransaction = async <T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> => {
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error: any) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (_e) {}
    }
    // If MongoDB is running in standalone mode (no replica set), fallback to non-transactional execution
    if (
      error?.code === 20 ||
      error?.codeName === "IllegalOperation" ||
      error?.message?.includes("replica set member")
    ) {
      return fn(null);
    }
    throw error;
  } finally {
    if (session) {
      try {
        session.endSession();
      } catch (_e) {}
    }
  }
};

export const createLeaveRequestService = async (
  data: {
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    reason: string;
  },
  user: JwtPayload,
  req?: Request
) => {
  const employeeId = user.userId;

  if (!Types.ObjectId.isValid(employeeId)) {
    throw new AppError("Invalid employee ID", 400, "INVALID_EMPLOYEE_ID");
  }

  if (!Types.ObjectId.isValid(data.leaveTypeId)) {
    throw new AppError("Invalid leave type ID", 400, "INVALID_LEAVE_TYPE_ID");
  }

  if (!isValidDateString(data.fromDate) || !isValidDateString(data.toDate)) {
    throw new AppError(
      "Invalid date format. Expected YYYY-MM-DD",
      400,
      "INVALID_DATE_FORMAT"
    );
  }

  if (data.fromDate > data.toDate) {
    throw new AppError(
      "From date cannot be after to date",
      400,
      "INVALID_DATE_RANGE"
    );
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  if (employee.status !== "ACTIVE") {
    throw new AppError(
      "Inactive or suspended employees cannot apply for leave",
      403,
      "EMPLOYEE_NOT_ACTIVE"
    );
  }

  const leaveType = await LeaveType.findById(data.leaveTypeId);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
  }

  if (leaveType.status !== "ACTIVE") {
    throw new AppError(
      "Cannot apply for an inactive leave type",
      400,
      "INACTIVE_LEAVE_TYPE"
    );
  }

  // 1. Notice days check
  if (leaveType.rules.minNoticeDays > 0) {
    const noticeDays = calculateNoticeDays(
      new Date(),
      employee.timezone,
      data.fromDate
    );
    if (noticeDays < leaveType.rules.minNoticeDays) {
      throw new AppError(
        `Leave must be applied at least ${leaveType.rules.minNoticeDays} day(s) in advance`,
        400,
        "MIN_NOTICE_DAYS_VIOLATION"
      );
    }
  }

  // 2. Fetch holidays in range
  const holidays = await findHolidaysInRange(data.fromDate, data.toDate, true);

  // 3. Calculate leave days accounting for timezone, weekends, holidays, policy
  const calculation = calculateLeaveDays(
    data.fromDate,
    data.toDate,
    leaveType.rules,
    holidays
  );

  if (calculation.days <= 0) {
    throw new AppError(
      "Selected date range contains 0 billable working days (all selected days are weekends/holidays)",
      400,
      "ZERO_LEAVE_DAYS"
    );
  }

  // 4. Consecutive days check
  if (
    leaveType.rules.maxConsecutiveDays &&
    calculation.days > leaveType.rules.maxConsecutiveDays
  ) {
    throw new AppError(
      `Leave exceeds maximum allowed consecutive days (${leaveType.rules.maxConsecutiveDays})`,
      400,
      "MAX_CONSECUTIVE_DAYS_EXCEEDED"
    );
  }

  // 5. Balance check
  const startYear = parseInt(data.fromDate.split("-")[0], 10);
  const balance = await LeaveBalance.findOne({
    employeeId: employee._id,
    leaveTypeId: leaveType._id,
    year: startYear,
  });

  if (!balance) {
    throw new AppError(
      `No leave balance allocated for ${leaveType.name} in year ${startYear}`,
      400,
      "LEAVE_BALANCE_NOT_FOUND"
    );
  }

  if (!leaveType.rules.allowNegativeBalance && balance.available < calculation.days) {
    throw new AppError(
      `Insufficient leave balance. Available: ${balance.available}, Requested: ${calculation.days}`,
      400,
      "INSUFFICIENT_LEAVE_BALANCE"
    );
  }

  // 6. Overlap check
  const overlapping = await findOverlappingLeaves(
    employeeId,
    data.fromDate,
    data.toDate,
    undefined,
    ["PENDING", "APPROVED"]
  );

  if (overlapping.length > 0) {
    throw new AppError(
      "Leave request overlaps with an existing pending or approved leave request",
      409,
      "LEAVE_OVERLAP"
    );
  }

  // 7. Create Leave Request
  const leaveRequest = await createLeaveRequest({
    employeeId: employee._id as Types.ObjectId,
    leaveTypeId: leaveType._id as Types.ObjectId,
    fromDate: data.fromDate,
    toDate: data.toDate,
    days: calculation.days,
    reason: data.reason.trim(),
    status: "PENDING",
  });

  // 8. Audit Log
  await recordAuditLog({
    actorId: employee._id as Types.ObjectId,
    action: "LEAVE_CREATED",
    entityType: "LeaveRequest",
    entityId: leaveRequest._id as Types.ObjectId,
    newValue: leaveRequest,
    metadata: {
      calculatedDays: calculation.days,
      excludedWeekends: calculation.weekendDaysCount,
      excludedHolidays: calculation.holidayDaysCount,
    },
    req,
  });

  // 9. Notification
  await notificationService.notifyLeaveCreated(leaveRequest, employee);

  return leaveRequest;
};

export const getLeaveRequestsService = async (
  user: JwtPayload,
  page: number = 1,
  limit: number = 10,
  employeeId?: string,
  departmentId?: string,
  leaveTypeId?: string,
  status?: string,
  fromDate?: string,
  toDate?: string
) => {
  const filter: Record<string, any> = {};

  if (user.role === "EMPLOYEE") {
    filter.employeeId = new Types.ObjectId(user.userId);
  } else if (user.role === "MANAGER") {
    if (employeeId) {
      const targetEmp = await Employee.findById(employeeId);
      if (
        !targetEmp ||
        (targetEmp._id.toString() !== user.userId &&
          targetEmp.managerId?.toString() !== user.userId)
      ) {
        throw new AppError(
          "You are not authorized to view leave requests for this employee",
          403,
          "FORBIDDEN"
        );
      }
      filter.employeeId = new Types.ObjectId(employeeId);
    } else {
      const teamEmployees = await Employee.find({
        $or: [
          { managerId: new Types.ObjectId(user.userId) },
          { _id: new Types.ObjectId(user.userId) },
        ],
      }).select("_id");
      filter.employeeId = { $in: teamEmployees.map((e) => e._id) };
    }
  } else if (user.role === "HR" || user.role === "ADMIN") {
    if (employeeId) {
      filter.employeeId = new Types.ObjectId(employeeId);
    } else if (departmentId) {
      const deptEmployees = await Employee.find({
        departmentId: new Types.ObjectId(departmentId),
      }).select("_id");
      filter.employeeId = { $in: deptEmployees.map((e) => e._id) };
    }
  }

  if (leaveTypeId) {
    filter.leaveTypeId = new Types.ObjectId(leaveTypeId);
  }

  if (status) {
    filter.status = status;
  }

  if (fromDate || toDate) {
    if (fromDate && toDate) {
      filter.$and = [
        { fromDate: { $lte: toDate } },
        { toDate: { $gte: fromDate } },
      ];
    } else if (fromDate) {
      filter.toDate = { $gte: fromDate };
    } else if (toDate) {
      filter.fromDate = { $lte: toDate };
    }
  }

  const skip = (page - 1) * limit;
  const result = await findLeaveRequests(filter, skip, limit);

  return {
    ...result,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  };
};

export const getLeaveRequestByIdService = async (
  id: string,
  user: JwtPayload
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid leave request ID", 400, "INVALID_LEAVE_ID");
  }

  const leave = await findLeaveRequestById(id);
  if (!leave) {
    throw new AppError("Leave request not found", 404, "LEAVE_NOT_FOUND");
  }

  const applicant = leave.employeeId as unknown as IEmployee;

  if (user.role === "EMPLOYEE") {
    if (applicant._id.toString() !== user.userId) {
      throw new AppError(
        "You do not have permission to view this leave request",
        403,
        "FORBIDDEN"
      );
    }
  } else if (user.role === "MANAGER") {
    const isSelf = applicant._id.toString() === user.userId;
    const isDirectReport = applicant.managerId?.toString() === user.userId;
    if (!isSelf && !isDirectReport) {
      throw new AppError(
        "You do not have permission to view this leave request",
        403,
        "FORBIDDEN"
      );
    }
  }

  return leave;
};

export const approveLeaveService = async (
  id: string,
  user: JwtPayload,
  req?: Request
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid leave request ID", 400, "INVALID_LEAVE_ID");
  }

  if (user.role === "EMPLOYEE") {
    throw new AppError(
      "Employees cannot approve leave requests",
      403,
      "FORBIDDEN"
    );
  }

  const leave = await findLeaveRequestById(id);
  if (!leave) {
    throw new AppError("Leave request not found", 404, "LEAVE_NOT_FOUND");
  }

  const applicant = leave.employeeId as unknown as IEmployee;
  const approver = await Employee.findById(user.userId);
  if (!approver) {
    throw new AppError("Approver not found", 404, "APPROVER_NOT_FOUND");
  }

  if (user.role === "MANAGER") {
    if (applicant.managerId?.toString() !== user.userId) {
      throw new AppError(
        "Managers can only approve leave requests for their direct reports",
        403,
        "FORBIDDEN"
      );
    }
  }

  if (applicant._id.toString() === user.userId) {
    throw new AppError(
      "You cannot approve your own leave request",
      403,
      "CANNOT_APPROVE_OWN_LEAVE"
    );
  }

  if (leave.status !== "PENDING") {
    throw new AppError(
      `Cannot approve leave with status ${leave.status}`,
      400,
      "INVALID_LEAVE_STATUS"
    );
  }

  const startYear = parseInt(leave.fromDate.split("-")[0], 10);
  const balance = await LeaveBalance.findOne({
    employeeId: applicant._id,
    leaveTypeId: (leave.leaveTypeId as any)._id ?? leave.leaveTypeId,
    year: startYear,
  });

  if (!balance) {
    throw new AppError(
      `Leave balance not found for year ${startYear}`,
      404,
      "LEAVE_BALANCE_NOT_FOUND"
    );
  }

  const leaveType = await LeaveType.findById(leave.leaveTypeId);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
  }

  if (!leaveType.rules.allowNegativeBalance && balance.available < leave.days) {
    throw new AppError(
      `Insufficient balance for approval. Available: ${balance.available}, Required: ${leave.days}`,
      400,
      "INSUFFICIENT_LEAVE_BALANCE"
    );
  }

  const overlappingApproved = await findOverlappingLeaves(
    applicant._id.toString(),
    leave.fromDate,
    leave.toDate,
    leave._id.toString(),
    ["APPROVED"]
  );

  if (overlappingApproved.length > 0) {
    throw new AppError(
      "An approved leave already overlaps with this date range",
      409,
      "LEAVE_OVERLAP"
    );
  }

  await runInTransaction(async (session) => {
    leave.status = "APPROVED";
    leave.approvedBy = new Types.ObjectId(user.userId);
    leave.approvedAt = new Date();
    await leave.save(session ? { session } : {});

    balance.used += leave.days;
    balance.available = balance.allocated - balance.used;
    await balance.save(session ? { session } : {});
  });

  await recordAuditLog({
    actorId: new Types.ObjectId(user.userId),
    action: "LEAVE_APPROVED",
    entityType: "LeaveRequest",
    entityId: leave._id as Types.ObjectId,
    oldValue: { status: "PENDING" },
    newValue: {
      status: "APPROVED",
      approvedBy: user.userId,
      approvedAt: leave.approvedAt,
    },
    req,
  });

  await notificationService.notifyLeaveApproved(leave, applicant, approver);

  return leave;
};

export const rejectLeaveService = async (
  id: string,
  rejectionReason: string | undefined,
  user: JwtPayload,
  req?: Request
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid leave request ID", 400, "INVALID_LEAVE_ID");
  }

  if (user.role === "EMPLOYEE") {
    throw new AppError(
      "Employees cannot reject leave requests",
      403,
      "FORBIDDEN"
    );
  }

  const leave = await findLeaveRequestById(id);
  if (!leave) {
    throw new AppError("Leave request not found", 404, "LEAVE_NOT_FOUND");
  }

  const applicant = leave.employeeId as unknown as IEmployee;
  const rejector = await Employee.findById(user.userId);
  if (!rejector) {
    throw new AppError("Rejector not found", 404, "REJECTOR_NOT_FOUND");
  }

  if (user.role === "MANAGER") {
    if (applicant.managerId?.toString() !== user.userId) {
      throw new AppError(
        "Managers can only reject leave requests for their direct reports",
        403,
        "FORBIDDEN"
      );
    }
  }

  if (applicant._id.toString() === user.userId) {
    throw new AppError(
      "You cannot reject your own leave request",
      403,
      "CANNOT_REJECT_OWN_LEAVE"
    );
  }

  if (leave.status !== "PENDING") {
    throw new AppError(
      `Cannot reject leave with status ${leave.status}`,
      400,
      "INVALID_LEAVE_STATUS"
    );
  }

  leave.status = "REJECTED";
  leave.rejectedBy = new Types.ObjectId(user.userId);
  leave.rejectedAt = new Date();
  leave.rejectionReason = rejectionReason;
  await leave.save();

  await recordAuditLog({
    actorId: new Types.ObjectId(user.userId),
    action: "LEAVE_REJECTED",
    entityType: "LeaveRequest",
    entityId: leave._id as Types.ObjectId,
    oldValue: { status: "PENDING" },
    newValue: {
      status: "REJECTED",
      rejectedBy: user.userId,
      rejectedAt: leave.rejectedAt,
      rejectionReason,
    },
    req,
  });

  await notificationService.notifyLeaveRejected(
    leave,
    applicant,
    rejector,
    rejectionReason
  );

  return leave;
};

export const cancelLeaveService = async (
  id: string,
  cancellationReason: string | undefined,
  user: JwtPayload,
  req?: Request
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid leave request ID", 400, "INVALID_LEAVE_ID");
  }

  const leave = await findLeaveRequestById(id);
  if (!leave) {
    throw new AppError("Leave request not found", 404, "LEAVE_NOT_FOUND");
  }

  const applicant = leave.employeeId as unknown as IEmployee;
  const isOwner = applicant._id.toString() === user.userId;
  const isHrOrAdmin = user.role === "HR" || user.role === "ADMIN";

  if (!isOwner && !isHrOrAdmin) {
    throw new AppError(
      "Unauthorized to cancel this leave request",
      403,
      "FORBIDDEN"
    );
  }

  if (leave.status === "CANCELLED") {
    throw new AppError(
      "Leave request is already cancelled",
      400,
      "ALREADY_CANCELLED"
    );
  }

  if (leave.status === "REJECTED") {
    throw new AppError(
      "Cannot cancel an already rejected leave request",
      400,
      "CANNOT_CANCEL_REJECTED_LEAVE"
    );
  }

  const leaveType = await LeaveType.findById(leave.leaveTypeId);
  if (isOwner && leaveType && leaveType.rules.allowCancellation === false) {
    throw new AppError(
      "Cancellation is not permitted by policy for this leave type",
      400,
      "CANCELLATION_NOT_ALLOWED"
    );
  }

  const previousStatus = leave.status;

  await runInTransaction(async (session) => {
    leave.status = "CANCELLED";
    leave.cancelledBy = new Types.ObjectId(user.userId);
    leave.cancelledAt = new Date();
    leave.cancellationReason = cancellationReason;
    await leave.save(session ? { session } : {});

    if (previousStatus === "APPROVED") {
      const startYear = parseInt(leave.fromDate.split("-")[0], 10);
      const balance = await LeaveBalance.findOne({
        employeeId: applicant._id,
        leaveTypeId: (leave.leaveTypeId as any)._id ?? leave.leaveTypeId,
        year: startYear,
      });

      if (balance) {
        balance.used = Math.max(0, balance.used - leave.days);
        balance.available = balance.allocated - balance.used;
        await balance.save(session ? { session } : {});
      }
    }
  });

  const canceller = (await Employee.findById(user.userId)) || applicant;

  await recordAuditLog({
    actorId: new Types.ObjectId(user.userId),
    action: "LEAVE_CANCELLED",
    entityType: "LeaveRequest",
    entityId: leave._id as Types.ObjectId,
    oldValue: { status: previousStatus },
    newValue: {
      status: "CANCELLED",
      cancelledBy: user.userId,
      cancelledAt: leave.cancelledAt,
      cancellationReason,
      restoredBalance: previousStatus === "APPROVED",
    },
    req,
  });

  await notificationService.notifyLeaveCancelled(leave, applicant, canceller);

  return leave;
};
