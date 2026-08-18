import request from "supertest";
import app from "../app";
import {
  clearTestDB,
  createTestAuthToken,
  createTestDepartment,
  createTestEmployee,
  createTestHoliday,
  createTestLeaveBalance,
  createTestLeaveType,
  setupTestDB,
  teardownTestDB,
} from "./test-helper";
import { Attendance } from "../models/attendance.model";
import { LeaveRequest } from "../models/leave-request.model";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

describe("Attendance Summary, Reports & CSV Export", () => {
  test("calculates monthly attendance summary with weekends and holidays accounted", async () => {
    const dept = await createTestDepartment("Engineering");
    const employee = await createTestEmployee({
      departmentId: dept._id,
      timezone: "Asia/Kolkata",
    });

    const empToken = createTestAuthToken(employee);

    // Month: August 2026 (31 days total: 9 weekend days if Sat/Sun: 1,2,8,9,15,16,22,23,29,30 -> 10 weekend days in Aug 2026)
    // Add 1 mandatory holiday on a weekday: e.g. Friday 2026-08-14
    await createTestHoliday("2026-08-14", "Holiday", "MANDATORY");

    // Create 3 attendance records for August 2026
    await Attendance.create([
      {
        employeeId: employee._id,
        date: "2026-08-03", // Mon
        checkInAt: new Date("2026-08-03T04:00:00.000Z"),
        checkOutAt: new Date("2026-08-03T12:30:00.000Z"),
        status: "PRESENT",
        timezone: "Asia/Kolkata",
      },
      {
        employeeId: employee._id,
        date: "2026-08-04", // Tue
        checkInAt: new Date("2026-08-04T05:00:00.000Z"),
        checkOutAt: new Date("2026-08-04T13:00:00.000Z"),
        status: "LATE",
        timezone: "Asia/Kolkata",
      },
      {
        employeeId: employee._id,
        date: "2026-08-05", // Wed
        checkInAt: new Date("2026-08-05T04:00:00.000Z"),
        checkOutAt: new Date("2026-08-05T07:00:00.000Z"),
        status: "HALF_DAY",
        timezone: "Asia/Kolkata",
      },
    ]);

    const res = await request(app)
      .get("/api/v1/attendance/summary?year=2026&month=8")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.year).toBe(2026);
    expect(data.month).toBe(8);
    expect(data.holidays).toBe(1);
    expect(data.weekends).toBe(10);
    // 31 total - 10 weekends - 1 holiday = 20 working days
    expect(data.workingDays).toBe(20);
    expect(data.present).toBe(1);
    expect(data.late).toBe(1);
    expect(data.halfDay).toBe(1);
    // Accounted: 1 + 1 + 1 = 3. Absent: 20 - 3 = 17
    expect(data.absent).toBe(17);
    // Credit: 1 (present) + 1 (late) + 0.5 (halfDay) = 2.5 / 20 * 100 = 12.5%
    expect(data.attendancePercentage).toBe(12.5);
  });

  test("retrieves attendance reports with filters and pagination via aggregation", async () => {
    const dept1 = await createTestDepartment("Sales");
    const dept2 = await createTestDepartment("Dev");
    const hr = await createTestEmployee({ role: "HR", departmentId: dept1._id });
    const emp1 = await createTestEmployee({ departmentId: dept1._id });
    const emp2 = await createTestEmployee({ departmentId: dept2._id });

    const hrToken = createTestAuthToken(hr);

    await Attendance.create([
      {
        employeeId: emp1._id,
        date: "2026-08-03",
        checkInAt: new Date("2026-08-03T04:00:00.000Z"),
        checkOutAt: new Date("2026-08-03T12:00:00.000Z"),
        status: "PRESENT",
        timezone: "Asia/Kolkata",
      },
      {
        employeeId: emp2._id,
        date: "2026-08-03",
        checkInAt: new Date("2026-08-03T05:00:00.000Z"),
        checkOutAt: new Date("2026-08-03T13:00:00.000Z"),
        status: "LATE",
        timezone: "Asia/Kolkata",
      },
    ]);

    // Query filter by departmentId = dept1
    const res = await request(app)
      .get(`/api/v1/reports/attendance?departmentId=${dept1._id}&page=1&limit=10`)
      .set("Authorization", `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].employee.employeeCode).toBe(emp1.employeeCode);
    expect(res.body.data[0].workingHours).toBe(8);
  });

  test("exports attendance report as CSV with correct headers", async () => {
    const dept = await createTestDepartment("Ops");
    const admin = await createTestEmployee({ role: "ADMIN", departmentId: dept._id });
    const emp = await createTestEmployee({ departmentId: dept._id });

    const adminToken = createTestAuthToken(admin);

    await Attendance.create({
      employeeId: emp._id,
      date: "2026-08-10",
      checkInAt: new Date("2026-08-10T04:00:00.000Z"),
      checkOutAt: new Date("2026-08-10T12:00:00.000Z"),
      status: "PRESENT",
      timezone: "Asia/Kolkata",
    });

    const res = await request(app)
      .get("/api/v1/reports/attendance/export")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment; filename=");
    expect(res.text).toContain("Employee Code,Employee Name,Department,Date,Check-In,Check-Out,Status,Working Hours,Late");
    expect(res.text).toContain(emp.employeeCode);
  });

  test("retrieves leave reports and exports leave report as CSV", async () => {
    const dept = await createTestDepartment("HR");
    const admin = await createTestEmployee({ role: "ADMIN", departmentId: dept._id });
    const emp = await createTestEmployee({ departmentId: dept._id });
    const leaveType = await createTestLeaveType({ name: "Sick Leave", code: "SL" });

    const adminToken = createTestAuthToken(admin);

    await LeaveRequest.create({
      employeeId: emp._id,
      leaveTypeId: leaveType._id,
      fromDate: "2026-08-20",
      toDate: "2026-08-21",
      days: 2,
      reason: "Flu recovery",
      status: "APPROVED",
      approvedBy: admin._id,
      approvedAt: new Date(),
    });

    // 1. Report JSON
    const reportRes = await request(app)
      .get("/api/v1/reports/leaves?status=APPROVED")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.length).toBe(1);
    expect(reportRes.body.data[0].employee.employeeCode).toBe(emp.employeeCode);
    expect(reportRes.body.data[0].leaveType.code).toBe("SL");

    // 2. Report CSV Export
    const exportRes = await request(app)
      .get("/api/v1/reports/leaves/export?status=APPROVED")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers["content-type"]).toContain("text/csv");
    expect(exportRes.headers["content-disposition"]).toContain("attachment; filename=");
    expect(exportRes.text).toContain("Employee Code,Employee Name,Department,Leave Type,From Date,To Date,Days,Status,Reason");
    expect(exportRes.text).toContain("Flu recovery");
  });
});
