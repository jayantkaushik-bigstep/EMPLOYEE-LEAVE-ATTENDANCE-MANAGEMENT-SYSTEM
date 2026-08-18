import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { generateAccessToken } from "../utils/jwt";
import { Employee, EmployeeRole, IEmployee } from "../models/employee.model";
import { Department } from "../models/department.model";
import { LeaveType } from "../models/leave-type.model";
import { LeaveBalance } from "../models/leave-balance.model";
import { Holiday } from "../models/holiday.model";
import { LeaveRequest } from "../models/leave-request.model";
import { Attendance } from "../models/attendance.model";
import { AuditLog } from "../models/audit-log.model";

let mongoServer: MongoMemoryServer;

export const setupTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

export const teardownTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

export const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

export const createTestAuthToken = (
  employee: { _id: Types.ObjectId | string; employeeCode: string; role: EmployeeRole }
): string => {
  return generateAccessToken({
    userId: employee._id.toString(),
    employeeCode: employee.employeeCode,
    role: employee.role,
  });
};

export const createTestDepartment = async (name: string = "Engineering") => {
  return Department.create({
    name,
  });
};

export const createTestEmployee = async (overrides: Partial<any> = {}) => {
  const code = overrides.employeeCode || `EMP-${Math.floor(Math.random() * 10000)}`;
  const email = overrides.email || `${code.toLowerCase()}@example.com`;

  return Employee.create({
    employeeCode: code,
    name: overrides.name || "Test User",
    email,
    passwordHash: overrides.passwordHash || "$2a$12$e6e0j.FwK2J8l7mKxY...",
    role: overrides.role || "EMPLOYEE",
    managerId: overrides.managerId,
    departmentId: overrides.departmentId || new Types.ObjectId(),
    joiningDate: overrides.joiningDate || new Date("2025-01-01"),
    timezone: overrides.timezone || "Asia/Kolkata",
    status: overrides.status || "ACTIVE",
  });
};

export const createTestLeaveType = async (overrides: Partial<any> = {}) => {
  return LeaveType.create({
    name: overrides.name || "Annual Leave",
    code: overrides.code || "AL",
    annualQuota: overrides.annualQuota ?? 20,
    rules: {
      allowNegativeBalance: false,
      excludeWeekends: true,
      excludeMandatoryHolidays: true,
      allowHalfDay: false,
      allowCancellation: true,
      maxConsecutiveDays: 15,
      minNoticeDays: 0,
      ...(overrides.rules || {}),
    },
    status: overrides.status || "ACTIVE",
  });
};

export const createTestLeaveBalance = async (
  employeeId: Types.ObjectId | string,
  leaveTypeId: Types.ObjectId | string,
  year: number = 2026,
  allocated: number = 20,
  used: number = 0
) => {
  return LeaveBalance.create({
    employeeId: new Types.ObjectId(String(employeeId)),
    leaveTypeId: new Types.ObjectId(String(leaveTypeId)),
    year,
    allocated,
    used,
    available: allocated - used,
  });
};

export const createTestHoliday = async (
  date: string,
  name: string = "Test Holiday",
  type: "MANDATORY" | "OPTIONAL" = "MANDATORY",
  status: "ACTIVE" | "INACTIVE" = "ACTIVE"
) => {
  return Holiday.create({
    date,
    name,
    type,
    status,
  });
};
