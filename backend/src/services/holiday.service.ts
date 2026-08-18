import { Types } from "mongoose";
import { AppError } from "../errors/app-error";
import {
  createHoliday,
  deleteHoliday,
  findAllHolidays,
  findHolidayByDate,
  findHolidayById,
  updateHoliday,
} from "../repositories/holiday.repository";
import { isValidDateString } from "../utils/leave-calculator.util";
import { recordAuditLog } from "./audit-log.service";
import { Request } from "express";

export const createHolidayService = async (
  data: {
    date: string;
    name: string;
    type?: "MANDATORY" | "OPTIONAL";
    status?: "ACTIVE" | "INACTIVE";
  },
  actorId: string,
  req?: Request
) => {
  if (!isValidDateString(data.date)) {
    throw new AppError(
      "Invalid date format or non-existent calendar date. Expected YYYY-MM-DD",
      400,
      "INVALID_DATE_FORMAT"
    );
  }

  const existing = await findHolidayByDate(data.date);
  if (existing) {
    throw new AppError(
      `Holiday already exists for date ${data.date}`,
      409,
      "HOLIDAY_ALREADY_EXISTS"
    );
  }

  const holiday = await createHoliday({
    date: data.date,
    name: data.name.trim(),
    type: data.type ?? "MANDATORY",
    status: data.status ?? "ACTIVE",
  });

  await recordAuditLog({
    actorId,
    action: "HOLIDAY_CREATED",
    entityType: "Holiday",
    entityId: holiday._id as Types.ObjectId,
    newValue: holiday,
    req,
  });

  return holiday;
};

export const getHolidaysService = async (
  page: number = 1,
  limit: number = 50,
  year?: number,
  type?: string,
  status?: string
) => {
  const filter: Record<string, any> = {};

  if (year) {
    filter.date = {
      $gte: `${year}-01-01`,
      $lte: `${year}-12-31`,
    };
  }

  if (type) {
    filter.type = type;
  }

  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;
  const result = await findAllHolidays(filter, skip, limit);

  return {
    ...result,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  };
};

export const getHolidayByIdService = async (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid holiday ID", 400, "INVALID_HOLIDAY_ID");
  }

  const holiday = await findHolidayById(id);
  if (!holiday) {
    throw new AppError("Holiday not found", 404, "HOLIDAY_NOT_FOUND");
  }

  return holiday;
};

export const updateHolidayService = async (
  id: string,
  data: Partial<{
    name: string;
    type: "MANDATORY" | "OPTIONAL";
    status: "ACTIVE" | "INACTIVE";
  }>,
  actorId: string,
  req?: Request
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid holiday ID", 400, "INVALID_HOLIDAY_ID");
  }

  const existing = await findHolidayById(id);
  if (!existing) {
    throw new AppError("Holiday not found", 404, "HOLIDAY_NOT_FOUND");
  }

  const updated = await updateHoliday(id, data);

  await recordAuditLog({
    actorId,
    action: "HOLIDAY_UPDATED",
    entityType: "Holiday",
    entityId: existing._id as Types.ObjectId,
    oldValue: existing,
    newValue: updated,
    req,
  });

  return updated;
};

export const deleteHolidayService = async (
  id: string,
  actorId: string,
  req?: Request
) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid holiday ID", 400, "INVALID_HOLIDAY_ID");
  }

  const existing = await findHolidayById(id);
  if (!existing) {
    throw new AppError("Holiday not found", 404, "HOLIDAY_NOT_FOUND");
  }

  await deleteHoliday(id);

  await recordAuditLog({
    actorId,
    action: "HOLIDAY_DELETED",
    entityType: "Holiday",
    entityId: existing._id as Types.ObjectId,
    oldValue: existing,
    req,
  });

  return existing;
};
