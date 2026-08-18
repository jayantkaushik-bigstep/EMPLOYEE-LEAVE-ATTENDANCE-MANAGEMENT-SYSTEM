import { Types } from "mongoose";
import { AppError } from "../errors/app-error";
import { Employee } from "../models/employee.model";
import {
  aggregateAttendanceReport,
  aggregateLeaveReport,
  AttendanceReportFilter,
  LeaveReportFilter,
} from "../repositories/report.repository";
import { JwtPayload } from "../types/auth.types";
import { CsvColumn, jsonToCsv } from "../utils/csv.util";

const resolveScopeFilter = async (
  user: JwtPayload,
  employeeId?: string,
  departmentId?: string
): Promise<{
  scopedEmployeeIds?: Types.ObjectId[];
  scopedEmployeeId?: Types.ObjectId;
  scopedDepartmentId?: Types.ObjectId;
}> => {
  if (user.role === "EMPLOYEE") {
    return {
      scopedEmployeeId: new Types.ObjectId(user.userId),
    };
  }

  if (user.role === "MANAGER") {
    if (employeeId) {
      const emp = await Employee.findById(employeeId);
      if (
        !emp ||
        (emp._id.toString() !== user.userId &&
          emp.managerId?.toString() !== user.userId)
      ) {
        throw new AppError(
          "You are not authorized to view reports for this employee",
          403,
          "FORBIDDEN"
        );
      }
      return { scopedEmployeeId: new Types.ObjectId(employeeId) };
    }

    const team = await Employee.find({
      $or: [
        { managerId: new Types.ObjectId(user.userId) },
        { _id: new Types.ObjectId(user.userId) },
      ],
    }).select("_id");

    return {
      scopedEmployeeIds: team.map((e) => e._id as Types.ObjectId),
    };
  }

  // HR / ADMIN
  return {
    scopedEmployeeId: employeeId
      ? new Types.ObjectId(employeeId)
      : undefined,
    scopedDepartmentId: departmentId
      ? new Types.ObjectId(departmentId)
      : undefined,
  };
};

export const getAttendanceReportService = async (
  user: JwtPayload,
  page: number = 1,
  limit: number = 20,
  employeeId?: string,
  departmentId?: string,
  fromDate?: string,
  toDate?: string,
  status?: string
) => {
  const scope = await resolveScopeFilter(user, employeeId, departmentId);

  const filter: AttendanceReportFilter = {
    employeeIds: scope.scopedEmployeeIds,
    employeeId: scope.scopedEmployeeId,
    departmentId: scope.scopedDepartmentId,
    fromDate,
    toDate,
    status,
  };

  const skip = (page - 1) * limit;
  const { data, total } = await aggregateAttendanceReport(filter, skip, limit);

  return {
    records: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const exportAttendanceReportCsvService = async (
  user: JwtPayload,
  employeeId?: string,
  departmentId?: string,
  fromDate?: string,
  toDate?: string,
  status?: string
): Promise<string> => {
  const scope = await resolveScopeFilter(user, employeeId, departmentId);

  const filter: AttendanceReportFilter = {
    employeeIds: scope.scopedEmployeeIds,
    employeeId: scope.scopedEmployeeId,
    departmentId: scope.scopedDepartmentId,
    fromDate,
    toDate,
    status,
  };

  // Limit 0 returns all records
  const { data } = await aggregateAttendanceReport(filter, 0, 0);

  const columns: CsvColumn[] = [
    { header: "Employee Code", accessor: (r) => r.employee?.employeeCode || "" },
    { header: "Employee Name", accessor: (r) => r.employee?.name || "" },
    { header: "Department", accessor: (r) => r.employee?.departmentName || "" },
    { header: "Date", accessor: (r) => r.date || "" },
    {
      header: "Check-In",
      accessor: (r) =>
        r.checkIn ? new Date(r.checkIn).toISOString() : "N/A",
    },
    {
      header: "Check-Out",
      accessor: (r) =>
        r.checkOut ? new Date(r.checkOut).toISOString() : "N/A",
    },
    { header: "Status", accessor: (r) => r.status || "" },
    { header: "Working Hours", accessor: (r) => r.workingHours ?? 0 },
    { header: "Late", accessor: (r) => (r.isLate ? "YES" : "NO") },
  ];

  return jsonToCsv(data, columns);
};

export const getLeaveReportService = async (
  user: JwtPayload,
  page: number = 1,
  limit: number = 20,
  employeeId?: string,
  departmentId?: string,
  leaveTypeId?: string,
  status?: string,
  fromDate?: string,
  toDate?: string
) => {
  const scope = await resolveScopeFilter(user, employeeId, departmentId);

  const filter: LeaveReportFilter = {
    employeeIds: scope.scopedEmployeeIds,
    employeeId: scope.scopedEmployeeId,
    departmentId: scope.scopedDepartmentId,
    leaveTypeId: leaveTypeId ? new Types.ObjectId(leaveTypeId) : undefined,
    status,
    fromDate,
    toDate,
  };

  const skip = (page - 1) * limit;
  const { data, total } = await aggregateLeaveReport(filter, skip, limit);

  return {
    records: data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const exportLeaveReportCsvService = async (
  user: JwtPayload,
  employeeId?: string,
  departmentId?: string,
  leaveTypeId?: string,
  status?: string,
  fromDate?: string,
  toDate?: string
): Promise<string> => {
  const scope = await resolveScopeFilter(user, employeeId, departmentId);

  const filter: LeaveReportFilter = {
    employeeIds: scope.scopedEmployeeIds,
    employeeId: scope.scopedEmployeeId,
    departmentId: scope.scopedDepartmentId,
    leaveTypeId: leaveTypeId ? new Types.ObjectId(leaveTypeId) : undefined,
    status,
    fromDate,
    toDate,
  };

  const { data } = await aggregateLeaveReport(filter, 0, 0);

  const columns: CsvColumn[] = [
    { header: "Employee Code", accessor: (r) => r.employee?.employeeCode || "" },
    { header: "Employee Name", accessor: (r) => r.employee?.name || "" },
    { header: "Department", accessor: (r) => r.employee?.departmentName || "" },
    { header: "Leave Type", accessor: (r) => r.leaveType?.name || "" },
    { header: "From Date", accessor: (r) => r.fromDate || "" },
    { header: "To Date", accessor: (r) => r.toDate || "" },
    { header: "Days", accessor: (r) => r.days || 0 },
    { header: "Status", accessor: (r) => r.status || "" },
    { header: "Reason", accessor: (r) => r.reason || "" },
    { header: "Approved By", accessor: (r) => r.approver?.name || "N/A" },
    {
      header: "Approved At",
      accessor: (r) =>
        r.approvedAt ? new Date(r.approvedAt).toISOString() : "N/A",
    },
    { header: "Rejection Reason", accessor: (r) => r.rejectionReason || "N/A" },
    {
      header: "Cancellation Reason",
      accessor: (r) => r.cancellationReason || "N/A",
    },
  ];

  return jsonToCsv(data, columns);
};
