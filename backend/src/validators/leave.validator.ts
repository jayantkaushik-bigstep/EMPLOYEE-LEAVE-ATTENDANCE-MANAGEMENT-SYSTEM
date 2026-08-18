import { z } from "zod";

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type ID is required"),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format"),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format"),
  reason: z
    .string()
    .min(3, "Reason must be at least 3 characters")
    .max(500, "Reason cannot exceed 500 characters"),
});

export const rejectLeaveSchema = z.object({
  rejectionReason: z
    .string()
    .min(2, "Rejection reason is required")
    .max(500, "Rejection reason cannot exceed 500 characters")
    .optional(),
});

export const cancelLeaveSchema = z.object({
  cancellationReason: z
    .string()
    .max(500, "Cancellation reason cannot exceed 500 characters")
    .optional(),
});
