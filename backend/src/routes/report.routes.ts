import { Router } from "express";
import {
  exportAttendanceReportCsv,
  exportLeaveReportCsv,
  getAttendanceReport,
  getLeaveReport,
} from "../controllers/report.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Reports
 *     description: Attendance & Leave reporting and CSV export
 */

/**
 * @swagger
 * /reports/attendance:
 *   get:
 *     summary: Get attendance report
 *     description: Aggregated attendance report with filters. Scoped by user role (Employees see self, Managers see direct reports, HR/Admin see all).
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema: { type: string }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, example: "2026-08-01" }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, example: "2026-08-31" }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PRESENT, LATE, HALF_DAY, ABSENT, LEAVE] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Attendance report fetched successfully
 */
router.get("/attendance", getAttendanceReport);

/**
 * @swagger
 * /reports/attendance/export:
 *   get:
 *     summary: Export attendance report to CSV
 *     description: Generates a CSV file download of attendance records matching the filters.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema: { type: string }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string }
 *       - in: query
 *         name: toDate
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file generated
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get("/attendance/export", exportAttendanceReportCsv);

/**
 * @swagger
 * /reports/leaves:
 *   get:
 *     summary: Get leave report
 *     description: Aggregated leave requests report with filters. Scoped by user role.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema: { type: string }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string }
 *       - in: query
 *         name: leaveTypeId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED, CANCELLED] }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string }
 *       - in: query
 *         name: toDate
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Leave report fetched successfully
 */
router.get("/leaves", getLeaveReport);

/**
 * @swagger
 * /reports/leaves/export:
 *   get:
 *     summary: Export leave report to CSV
 *     description: Generates a CSV file download of leave records matching the filters.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema: { type: string }
 *       - in: query
 *         name: departmentId
 *         schema: { type: string }
 *       - in: query
 *         name: leaveTypeId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string }
 *       - in: query
 *         name: toDate
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file generated
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get("/leaves/export", exportLeaveReportCsv);

export default router;
