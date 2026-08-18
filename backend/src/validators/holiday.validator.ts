import { z } from "zod";

export const createHolidaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  name: z
    .string()
    .min(2, "Holiday name must be at least 2 characters")
    .max(100, "Holiday name must be at most 100 characters"),
  type: z.enum(["MANDATORY", "OPTIONAL"]).default("MANDATORY"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const updateHolidaySchema = z.object({
  name: z
    .string()
    .min(2, "Holiday name must be at least 2 characters")
    .max(100, "Holiday name must be at most 100 characters")
    .optional(),
  type: z.enum(["MANDATORY", "OPTIONAL"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
