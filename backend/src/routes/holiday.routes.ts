import { Router } from "express";
import {
  createHoliday,
  deleteHoliday,
  getHoliday,
  getHolidays,
  updateHoliday,
} from "../controllers/holiday.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createHolidaySchema,
  updateHolidaySchema,
} from "../validators/holiday.validator";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   - name: Holidays
 *     description: Company holiday management
 */

/**
 * @swagger
 * /holidays:
 *   get:
 *     summary: List holidays
 *     description: Authenticated users can list holidays.
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [MANDATORY, OPTIONAL] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Holidays fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Holidays fetched successfully }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Holiday'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get("/", getHolidays);

/**
 * @swagger
 * /holidays/{id}:
 *   get:
 *     summary: Get a single holiday
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Holiday fetched successfully
 *       404:
 *         description: Holiday not found
 */
router.get("/:id", getHoliday);

/**
 * @swagger
 * /holidays:
 *   post:
 *     summary: Create a holiday
 *     description: Requires HR or ADMIN role.
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, name]
 *             properties:
 *               date: { type: string, example: "2026-08-15" }
 *               name: { type: string, example: "Independence Day" }
 *               type: { type: string, enum: [MANDATORY, OPTIONAL], default: MANDATORY }
 *               status: { type: string, enum: [ACTIVE, INACTIVE], default: ACTIVE }
 *     responses:
 *       201:
 *         description: Holiday created successfully
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Holiday already exists on this date
 */
router.post(
  "/",
  authorize("HR", "ADMIN"),
  validate(createHolidaySchema),
  createHoliday
);

/**
 * @swagger
 * /holidays/{id}:
 *   patch:
 *     summary: Update a holiday
 *     description: Requires HR or ADMIN role.
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               type: { type: string, enum: [MANDATORY, OPTIONAL] }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *     responses:
 *       200:
 *         description: Holiday updated successfully
 *       404:
 *         description: Holiday not found
 */
router.patch(
  "/:id",
  authorize("HR", "ADMIN"),
  validate(updateHolidaySchema),
  updateHoliday
);

/**
 * @swagger
 * /holidays/{id}:
 *   delete:
 *     summary: Delete a holiday
 *     description: Requires HR or ADMIN role.
 *     tags: [Holidays]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Holiday deleted successfully
 *       404:
 *         description: Holiday not found
 */
router.delete("/:id", authorize("HR", "ADMIN"), deleteHoliday);

export default router;
