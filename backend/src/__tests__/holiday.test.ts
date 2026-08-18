import request from "supertest";
import app from "../app";
import {
  clearTestDB,
  createTestAuthToken,
  createTestDepartment,
  createTestEmployee,
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

describe("Holiday Management", () => {
  test("creates a new holiday and prevents duplicate dates", async () => {
    const dept = await createTestDepartment();
    const hr = await createTestEmployee({ role: "HR", departmentId: dept._id });
    const hrToken = createTestAuthToken(hr);

    // 1. Create holiday
    const createRes = await request(app)
      .post("/api/v1/holidays")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        date: "2026-10-02",
        name: "Gandhi Jayanti",
        type: "MANDATORY",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.date).toBe("2026-10-02");

    // 2. Duplicate creation attempt
    const dupRes = await request(app)
      .post("/api/v1/holidays")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({
        date: "2026-10-02",
        name: "Duplicate Holiday",
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe("HOLIDAY_ALREADY_EXISTS");
  });

  test("fetches holidays with filters and pagination", async () => {
    const dept = await createTestDepartment();
    const emp = await createTestEmployee({ role: "EMPLOYEE", departmentId: dept._id });
    const hr = await createTestEmployee({ role: "HR", departmentId: dept._id });

    const hrToken = createTestAuthToken(hr);
    const empToken = createTestAuthToken(emp);

    await request(app)
      .post("/api/v1/holidays")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ date: "2026-01-26", name: "Republic Day", type: "MANDATORY" });

    await request(app)
      .post("/api/v1/holidays")
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ date: "2026-03-25", name: "Holi", type: "OPTIONAL" });

    // Authenticated employee can list holidays
    const res = await request(app)
      .get("/api/v1/holidays?year=2026&type=MANDATORY")
      .set("Authorization", `Bearer ${empToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe("Republic Day");
  });

  test("updates and deletes a holiday", async () => {
    const dept = await createTestDepartment();
    const admin = await createTestEmployee({ role: "ADMIN", departmentId: dept._id });
    const adminToken = createTestAuthToken(admin);

    const createRes = await request(app)
      .post("/api/v1/holidays")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ date: "2026-12-25", name: "Christmas Day", type: "MANDATORY" });

    const holidayId = createRes.body.data._id;

    // Update
    const updateRes = await request(app)
      .patch(`/api/v1/holidays/${holidayId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Christmas" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe("Christmas");

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/holidays/${holidayId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);

    // Verify 404
    const getRes = await request(app)
      .get(`/api/v1/holidays/${holidayId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getRes.status).toBe(404);
  });
});
