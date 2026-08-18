import { Types } from "mongoose";
import { AppError } from "../errors/app-error";
import { env } from "../config/env";
import { Employee, IEmployee } from "../models/employee.model";
import { findEmployeeById } from "../repositories/employee.repository";
import {
  createAttendance,
  findAttendanceByEmployeeAndDate,
  findAttendanceInRange,
  findAttendanceRecords,
  updateAttendance,
} from "../repositories/attendance.repository";
import { findHolidaysInRange } from "../repositories/holiday.repository";
import {
  getLocalDateString,
  getLocalDayOfWeek,
  getLocalMinutesSinceMidnight,
  isWeekendDay,
} from "../utils/timezone.util";
import { JwtPayload } from "../types/auth.types";

const WEEKEND_DAYS = env.ATTENDANCE_WEEKEND_DAYS.split(",").map(Number);

const assertValidEmployee = async (employeeId: string): Promise<IEmployee> => {
  if (!Types.ObjectId.isValid(employeeId)) {
    throw new AppError("Invalid employee id", 400, "INVALID_EMPLOYEE_ID");
  }

  const employee = await findEmployeeById(employeeId);

  if (!employee) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  return employee;
};

export const checkInService = async (employeeId: string) => {
  const employee = await assertValidEmployee(employeeId);

  const now = new Date();
  const localDate = getLocalDateString(now, employee.timezone);

  const existing = await findAttendanceByEmployeeAndDate(
    employeeId,
    localDate
  );

  if (existing) {
    throw new AppError(
      "Employee has already checked in for today",
      409,
      "ALREADY_CHECKED_IN"
    );
  }

  const minutesSinceMidnight = getLocalMinutesSinceMidnight(
    now,
    employee.timezone
  );

  const status =
    minutesSinceMidnight > env.ATTENDANCE_LATE_CUTOFF_MINUTES
      ? "LATE"
      : "PRESENT";

  const attendance = await createAttendance({
    employeeId: employee._id as Types.ObjectId,
    date: localDate,
    checkInAt: now,
    status,
    timezone: employee.timezone,
  } as any);

  return attendance;
};

export const checkOutService = async (employeeId: string) => {
  const employee = await assertValidEmployee(employeeId);

  const now = new Date();
  const localDate = getLocalDateString(now, employee.timezone);

  const record = await findAttendanceByEmployeeAndDate(
    employeeId,
    localDate
  );

  if (!record) {
    throw new AppError(
      "No check-in found for today",
      404,
      "NO_CHECKIN_FOUND"
    );
  }

  if (record.checkOutAt) {
    throw new AppError(
      "Employee has already checked out for today",
      409,
      "ALREADY_CHECKED_OUT"
    );
  }

  if (now < record.checkInAt) {
    throw new AppError(
      "Check-out time cannot be before check-in time",
      400,
      "INVALID_CHECKOUT_TIME"
    );
  }

  const workedMinutes =
    (now.getTime() - record.checkInAt.getTime()) / 60000;

  const status =
    workedMinutes < env.ATTENDANCE_MIN_MINUTES_FULL_DAY
      ? "HALF_DAY"
      : record.status;

  const updated = await updateAttendance(record.id, {
    checkOutAt: now,
    status,
  });

  return updated;
};

export const getAttendanceListService = async (
  page: number,
  limit: number,
  employeeId?: string,
  status?: string,
  from?: string,
  to?: string
) => {
  const filter: Record<string, unknown> = {};

  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;

  if (from || to) {
    filter.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }

  const skip = (page - 1) * limit;
  const result = await findAttendanceRecords(filter, skip, limit);

  return {
    ...result,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  };
};

export const getMonthlyAttendanceSummaryService = async (
  targetEmployeeId: string,
  year: number,
  month: number, // 1-12
  user?: JwtPayload
) => {
  const employee = await assertValidEmployee(targetEmployeeId);

  // Authorization check if user context is provided
  if (user) {
    if (user.role === "EMPLOYEE") {
      if (employee._id.toString() !== user.userId) {
        throw new AppError(
          "You do not have permission to view this employee's attendance summary",
          403,
          "FORBIDDEN"
        );
      }
    } else if (user.role === "MANAGER") {
      const isSelf = employee._id.toString() === user.userId;
      const isDirectReport = employee.managerId?.toString() === user.userId;
      if (!isSelf && !isDirectReport) {
        throw new AppError(
          "Managers can only view attendance summary for their direct reports",
          403,
          "FORBIDDEN"
        );
      }
    }
  }

  const monthStr = String(month).padStart(2, "0");
  const fromDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const toDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // 1. Fetch holidays in this month
  const holidays = await findHolidaysInRange(fromDate, toDate, true);
  const holidayDateSet = new Set(
    holidays.filter((h) => h.type === "MANDATORY").map((h) => h.date)
  );

  // 2. Count calendar days, weekends, holidays, working days
  let weekendsCount = 0;
  let holidaysCount = 0;
  let workingDaysCount = 0;

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${monthStr}-${String(d).padStart(2, "0")}`;
    const isWk = isWeekendDay(dateStr, WEEKEND_DAYS);
    if (isWk) {
      weekendsCount++;
    } else if (holidayDateSet.has(dateStr)) {
      holidaysCount++;
    } else {
      workingDaysCount++;
    }
  }

  // 3. Query attendance records in this date range
  const records = await findAttendanceInRange(
    targetEmployeeId,
    fromDate,
    toDate
  );

  let present = 0;
  let late = 0;
  let halfDay = 0;
  let leave = 0;

  for (const record of records) {
    if (record.status === "PRESENT") present++;
    else if (record.status === "LATE") late++;
    else if (record.status === "HALF_DAY") halfDay++;
    else if (record.status === "LEAVE") leave++;
  }

  const accountedDays = present + late + halfDay + leave;
  const absent = Math.max(workingDaysCount - accountedDays, 0);

  // Attendance credit = present + late + (halfDay * 0.5)
  const attendanceCredit = present + late + halfDay * 0.5;
  const attendancePercentage =
    workingDaysCount > 0
      ? Number(((attendanceCredit / workingDaysCount) * 100).toFixed(2))
      : 100;

  return {
    employeeId: targetEmployeeId,
    year,
    month,
    workingDays: workingDaysCount,
    present,
    late,
    halfDay,
    leave,
    absent,
    holidays: holidaysCount,
    weekends: weekendsCount,
    attendancePercentage: Math.min(100, attendancePercentage),
    holidaysExcluded: true,
  };
};