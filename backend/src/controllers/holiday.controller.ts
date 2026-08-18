import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  createHolidayService,
  deleteHolidayService,
  getHolidayByIdService,
  getHolidaysService,
  updateHolidayService,
} from "../services/holiday.service";

export const createHoliday = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const holiday = await createHolidayService(
      req.body,
      req.user!.userId,
      req
    );

    return res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: holiday,
    });
  } catch (error) {
    next(error);
  }
};

export const getHolidays = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await getHolidaysService(
      page,
      limit,
      year,
      type,
      status
    );

    return res.status(200).json({
      success: true,
      message: "Holidays fetched successfully",
      data: result.holidays,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getHoliday = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const holiday = await getHolidayByIdService(req.params.id as string);

    return res.status(200).json({
      success: true,
      message: "Holiday fetched successfully",
      data: holiday,
    });
  } catch (error) {
    next(error);
  }
};

export const updateHoliday = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const holiday = await updateHolidayService(
      req.params.id as string,
      req.body,
      req.user!.userId,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Holiday updated successfully",
      data: holiday,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHoliday = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteHolidayService(
      req.params.id as string,
      req.user!.userId,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Holiday deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
