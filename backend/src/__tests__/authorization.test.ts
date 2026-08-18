import request from "supertest";
import app from "../app";
import {
  clearTestDB,
  createTestAuthToken,
  createTestDepartment,
  createTestEmployee,
  createTestLeaveBalance,
  createTestLeaveType,
  setupTestDB,
  teardownTestDB,
} from "./test-helper";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
});

describe("Authorization and Role Constraints", () => {
  test("employee cannot approve leave", async () => {
    const dept = await createTestDepartment();
    const emp1 = await createTestEmployee({ role: "EMPLOYEE", departmentId: dept._id });
    const emp2 = await createTestEmployee({ role: "EMPLOYEE", departmentId: dept._id });
    const leaveType = await createTestLeaveType();
    await createTestLeaveBalance(emp1._id, leaveType._id, 2026, 10, 0);

    const emp1Token = createTestAuthToken(emp1);
    const emp2Token = createTestAuthToken(emp2);

    const createRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-19",
        reason: "Time off",
      });

    const leaveId = createRes.body.data._id;

    // emp2 attempts to approve
    const approveRes = await request(app)
      .put(`/api/v1/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${emp2Token}`);

    expect(approveRes.status).toBe(403);
  });

  test("manager cannot approve leave for employees outside their team", async () => {
    const dept = await createTestDepartment();
    const manager1 = await createTestEmployee({ role: "MANAGER", departmentId: dept._id });
    const manager2 = await createTestEmployee({ role: "MANAGER", departmentId: dept._id });

    // Emp belongs to Manager 1
    const emp = await createTestEmployee({
      role: "EMPLOYEE",
      managerId: manager1._id,
      departmentId: dept._id,
    });

    const leaveType = await createTestLeaveType();
    await createTestLeaveBalance(emp._id, leaveType._id, 2026, 10, 0);

    const empToken = createTestAuthToken(emp);
    const mgr2Token = createTestAuthToken(manager2);

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

    // Manager 2 tries to approve
    const approveRes = await request(app)
      .put(`/api/v1/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${mgr2Token}`);

    expect(approveRes.status).toBe(403);
  });

  test("unauthorized user cannot cancel another employee's leave", async () => {
    const dept = await createTestDepartment();
    const emp1 = await createTestEmployee({ role: "EMPLOYEE", departmentId: dept._id });
    const emp2 = await createTestEmployee({ role: "EMPLOYEE", departmentId: dept._id });
    const leaveType = await createTestLeaveType();
    await createTestLeaveBalance(emp1._id, leaveType._id, 2026, 10, 0);

    const emp1Token = createTestAuthToken(emp1);
    const emp2Token = createTestAuthToken(emp2);

    const createRes = await request(app)
      .post("/api/v1/leaves")
      .set("Authorization", `Bearer ${emp1Token}`)
      .send({
        leaveTypeId: leaveType._id.toString(),
        fromDate: "2026-08-18",
        toDate: "2026-08-19",
        reason: "Time off",
      });

    const leaveId = createRes.body.data._id;

    // emp2 tries to cancel emp1's leave
    const cancelRes = await request(app)
      .put(`/api/v1/leaves/${leaveId}/cancel`)
      .set("Authorization", `Bearer ${emp2Token}`);

    expect(cancelRes.status).toBe(403);
  });
});
