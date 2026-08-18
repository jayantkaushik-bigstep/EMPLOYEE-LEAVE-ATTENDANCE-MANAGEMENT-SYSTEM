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
import { LeaveBalance } from "../models/leave-balance.model";
import { AuditLog } from "../models/audit-log.model";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

describe("Leave Workflow & Approval Engine", () => {
  test("creates a valid leave request and server calculates days without trusting req.body", async () => {
    const dept = await createTestDepartment("Tech");
    const manager = await createTestEmployee({
      name: "Manager Alice",
      role: "MANAGER",
      departmentId: dept._id,
    });
    const employee = await createTestEmployee({
      name: "Dev Bob",
      role: "EMPLOYEE",
      managerId: manager._id,
      departmentId: dept._id,
    });

    const leaveType = await createTestLeaveType({
      name: "Paid Time Off",
      code: "PTO",
      rules: {
        excludeWeekends: true,
        excludeMandatoryHolidays: true,
        allowNegativeBalance: false,
        maxConsecutiveDays: 10,
        minNoticeDays: 0,
      },
    });

    await createTestLeaveBalance(employee._id, leaveType._id, 2026, 15, 0);

    // Add a holiday on Monday 2026-08-17
    await createTestHoliday("2026-08-17", "Special Holiday", "MANDATORY");

    const empToken = createTestAuthToken(employee);

    // Apply for Fri 2026-08-14 to Tue 2026-08-18 (5 calendar days: Fri=work, Sat=wknd, Sun=wknd, Mon=holiday, Tue=work) -> 2 billable days
    const res = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-14",
        toDate: "2026-08-18",
        reason: "Trip",
        days: 999, // Should be ignored!
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.days).toBe(2);
    expect(res.body.data.status).toBe("PENDING");

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      entityId: res.body.data._id,
      action: "LEAVE_CREATED",
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId.toString()).toBe(employee._id.toString());
  });

  test("rejects leave request if balance is insufficient", async () => {
    const dept = await createTestDepartment();
    const employee = await createTestEmployee({ departmentId: dept._id });
    const leaveType = await createTestLeaveType();

    // Only 1 day allocated and available
    await createTestLeaveBalance(employee._id, leaveType._id, 2026, 1, 0);

    const empToken = createTestAuthToken(employee);

    // Apply for 3 working days (2026-08-18 to 2026-08-20: Tue, Wed, Thu)
    const res = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-20",
        reason: "Personal",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INSUFFICIENT_LEAVE_BALANCE");
  });

  test("rejects overlapping leave requests", async () => {
    const dept = await createTestDepartment();
    const employee = await createTestEmployee({ departmentId: dept._id });
    const leaveType = await createTestLeaveType();
    await createTestLeaveBalance(employee._id, leaveType._id, 2026, 20, 0);

    const empToken = createTestAuthToken(employee);

    // 1st request: 2026-08-18 to 2026-08-21
    const firstRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-21",
        reason: "First request",
      });
    expect(firstRes.status).toBe(201);

    // 2nd request overlapping: 2026-08-20 to 2026-08-25
    const secondRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-20",
        toDate: "2026-08-25",
        reason: "Second overlapping request",
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe("LEAVE_OVERLAP");
  });

  test("manager approves leave -> updates balance and creates audit log", async () => {
    const dept = await createTestDepartment();
    const manager = await createTestEmployee({
      role: "MANAGER",
      departmentId: dept._id,
    });
    const employee = await createTestEmployee({
      role: "EMPLOYEE",
      managerId: manager._id,
      departmentId: dept._id,
    });
    const leaveType = await createTestLeaveType();
    await createTestLeaveBalance(employee._id, leaveType._id, 2026, 10, 0);

    const empToken = createTestAuthToken(employee);
    const mgrToken = createTestAuthToken(manager);

    // Create 2-day leave
    const createRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-19",
        reason: "Conference",
      });

    const leaveId = createRes.body.data._id;

    // Approve
    const approveRes = await request(app)
      .put(`/api/v1/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${mgrToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe("APPROVED");
    expect(approveRes.body.data.approvedBy).toBe(manager._id.toString());

    // Verify balance deduction
    const updatedBalance = await LeaveBalance.findOne({
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
      year: 2026,
    });
    expect(updatedBalance?.used).toBe(2);
    expect(updatedBalance?.available).toBe(8);

    // Verify AuditLog
    const audit = await AuditLog.findOne({
      entityId: leaveId,
      action: "LEAVE_APPROVED",
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId.toString()).toBe(manager._id.toString());
  });

  test("rejecting leave does not consume balance", async () => {
    const dept = await createTestDepartment();
    const manager = await createTestEmployee({
      role: "MANAGER",
      departmentId: dept._id,
    });
    const employee = await createTestEmployee({
      role: "EMPLOYEE",
      managerId: manager._id,
      departmentId: dept._id,
    });
    const leaveType = await createTestLeaveType();
    await createTestLeaveBalance(employee._id, leaveType._id, 2026, 10, 0);

    const empToken = createTestAuthToken(employee);
    const mgrToken = createTestAuthToken(manager);

    const createRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-19",
        reason: "Time off",
      });

    const leaveId = createRes.body.data._id;

    const rejectRes = await request(app)
      .put(`/api/v1/leaves/${leaveId}/reject`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ rejectionReason: "Project release week" });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe("REJECTED");
    expect(rejectRes.body.data.rejectionReason).toBe("Project release week");

    // Balance remains 0 used, 10 available
    const balance = await LeaveBalance.findOne({
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
      year: 2026,
    });
    expect(balance?.used).toBe(0);
    expect(balance?.available).toBe(10);
  });

  test("cancelling approved leave restores balance", async () => {
    const dept = await createTestDepartment();
    const manager = await createTestEmployee({
      role: "MANAGER",
      departmentId: dept._id,
    });
    const employee = await createTestEmployee({
      role: "EMPLOYEE",
      managerId: manager._id,
      departmentId: dept._id,
    });
    const leaveType = await createTestLeaveType({
      rules: { allowCancellation: true, maxConsecutiveDays: 15, minNoticeDays: 0 },
    });
    await createTestLeaveBalance(employee._id, leaveType._id, 2026, 10, 0);

    const empToken = createTestAuthToken(employee);
    const mgrToken = createTestAuthToken(manager);

    const createRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-19",
        reason: "Vacation",
      });

    const leaveId = createRes.body.data._id;

    // Approve
    await request(app)
      .put(`/api/v1/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${mgrToken}`);

    // Check balance used = 2
    let balance = await LeaveBalance.findOne({
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
      year: 2026,
    });
    expect(balance?.used).toBe(2);

    // Cancel by employee
    const cancelRes = await request(app)
      .put(`/api/v1/leaves/${leaveId}/cancel`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ cancellationReason: "Plans changed" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("CANCELLED");

    // Balance restored to 0 used, 10 available
    balance = await LeaveBalance.findOne({
      employeeId: employee._id,
      leaveTypeId: leaveType._id,
      year: 2026,
    });
    expect(balance?.used).toBe(0);
    expect(balance?.available).toBe(10);
  });
});
