import { Router } from "express";
import {
  checkIn,
  checkOut,
  getAttendanceList,
  getMonthlySummary,
} from "../controllers/attendance.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Attendance
 *     description: Check-in/check-out and attendance reporting
 */

/**
 * @swagger
 * /attendance/summary:
 *   get:
 *     summary: Get monthly attendance summary
 *     description: Returns working days, present, late, absent, leave, holidays, weekends, and percentage.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema: { type: string }
 *         description: Defaults to logged-in user if omitted.
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12, example: 8 }
 *     responses:
 *       200:
 *         description: Monthly attendance summary fetched successfully
 *       403:
 *         description: Forbidden
 */
router.get("/summary", authenticate, getMonthlySummary);

/**
 * @swagger
 * /attendance/{employeeId}/check-in:
 *   post:
 *     summary: Check in an employee for today (their local calendar date)
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Checked in successfully
 *       400:
 *         description: Invalid employee id
 *       404:
 *         description: Employee not found
 *       409:
 *         description: Employee has already checked in for today
 */
router.post("/:employeeId/check-in", checkIn);

/**
 * @swagger
 * /attendance/{employeeId}/check-out:
 *   post:
 *     summary: Check out an employee for today (their local calendar date)
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Checked out successfully
 *       400:
 *         description: Invalid employee id or check-out before check-in
 *       404:
 *         description: Employee not found or no check-in
 *       409:
 *         description: Already checked out
 */
router.post("/:employeeId/check-out", checkOut);

/**
 * @swagger
 * /attendance/{employeeId}/summary:
 *   get:
 *     summary: Get an employee's monthly attendance summary by ID
 *     tags: [Attendance]
 *     parameters:
 *       - in: path
 *         name: employeeId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12, example: 8 }
 *     responses:
 *       200:
 *         description: Monthly attendance summary fetched successfully
 */
router.get("/:employeeId/summary", authenticate, getMonthlySummary);

/**
 * @swagger
 * /attendance:
 *   get:
 *     summary: List attendance records
 *     tags: [Attendance]
 *     parameters:
 *       - in: query
 *         name: employeeId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PRESENT, LATE, HALF_DAY, ABSENT, LEAVE]
 *       - in: query
 *         name: from
 *         schema: { type: string, example: "2026-08-01" }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: "2026-08-31" }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Attendance records fetched successfully
 */
router.get("/", getAttendanceList);

export default router;
