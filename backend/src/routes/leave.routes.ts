import { Router } from "express";
import {
  approveLeave,
  cancelLeave,
  createLeaveRequest,
  getLeaveRequestById,
  getLeaveRequests,
  rejectLeave,
} from "../controllers/leave.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  cancelLeaveSchema,
  createLeaveRequestSchema,
  rejectLeaveSchema,
} from "../validators/leave.validator";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Leaves
 *     description: Leave requests, approval workflow, and cancellation
 */

/**
 * @swagger
 * /leaves:
 *   post:
 *     summary: Submit a new leave request
 *     description: Authenticated employee submits a leave request. Backend calculates business days accounting for employee timezone, weekends, and holidays.
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leaveTypeId, fromDate, toDate, reason]
 *             properties:
 *               leaveTypeId: { type: string, example: "6612abf4c1a2b3d4e5f6a7b8" }
 *               fromDate: { type: string, example: "2026-08-18" }
 *               toDate: { type: string, example: "2026-08-20" }
 *               reason: { type: string, example: "Attending family function" }
 *     responses:
 *       201:
 *         description: Leave request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Leave request submitted successfully }
 *                 data:
 *                   $ref: '#/components/schemas/LeaveRequest'
 *       400:
 *         description: Validation failed, insufficient balance, or zero billable days
 *       409:
 *         description: Overlapping leave request exists
 */
router.post(
  "/",
  validate(createLeaveRequestSchema),
  createLeaveRequest
);

/**
 * @swagger
 * /leaves:
 *   get:
 *     summary: List leave requests
 *     description: Scoped by role. Employees see their own; Managers see their team; HR/Admin see all.
 *     tags: [Leaves]
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
 *         schema: { type: string, example: "2026-08-01" }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, example: "2026-08-31" }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Leave requests fetched successfully
 */
router.get("/", getLeaveRequests);

/**
 * @swagger
 * /leaves/{id}:
 *   get:
 *     summary: Get a single leave request
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave request fetched successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Leave request not found
 */
router.get("/:id", getLeaveRequestById);

/**
 * @swagger
 * /leaves/{id}/approve:
 *   put:
 *     summary: Approve a pending leave request
 *     description: Requires MANAGER (for direct reports), HR, or ADMIN role. Atomically updates leave status and deducts balance.
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave request approved successfully
 *       400:
 *         description: Invalid state or insufficient balance
 *       403:
 *         description: Unauthorized to approve this request
 *       404:
 *         description: Leave request not found
 *       409:
 *         description: Conflict with existing approved leave
 */
router.put(
  "/:id/approve",
  authorize("MANAGER", "HR", "ADMIN"),
  approveLeave
);

/**
 * @swagger
 * /leaves/{id}/reject:
 *   put:
 *     summary: Reject a pending leave request
 *     description: Requires MANAGER (for direct reports), HR, or ADMIN role. Does not alter balance.
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rejectionReason: { type: string, example: "High project workload during this period" }
 *     responses:
 *       200:
 *         description: Leave request rejected successfully
 *       400:
 *         description: Invalid state
 *       403:
 *         description: Unauthorized to reject this request
 *       404:
 *         description: Leave request not found
 */
router.put(
  "/:id/reject",
  authorize("MANAGER", "HR", "ADMIN"),
  validate(rejectLeaveSchema),
  rejectLeave
);

/**
 * @swagger
 * /leaves/{id}/cancel:
 *   put:
 *     summary: Cancel a leave request
 *     description: Employee can cancel their own leave (if allowed by policy) or HR/Admin. Restores balance if previously approved.
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancellationReason: { type: string, example: "Change of plans" }
 *     responses:
 *       200:
 *         description: Leave request cancelled successfully
 *       400:
 *         description: Cannot cancel (already cancelled, rejected, or disallowed by policy)
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Leave request not found
 */
router.put(
  "/:id/cancel",
  validate(cancelLeaveSchema),
  cancelLeave
);

export default router;
