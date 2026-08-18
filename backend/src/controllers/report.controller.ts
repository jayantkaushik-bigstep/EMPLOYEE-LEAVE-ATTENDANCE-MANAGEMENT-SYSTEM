import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  exportAttendanceReportCsvService,
  exportLeaveReportCsvService,
  getAttendanceReportService,
  getLeaveReportService,
} from "../services/report.service";

export const getAttendanceReport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const employeeId = req.query.employeeId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await getAttendanceReportService(
      req.user!,
      page,
      limit,
      employeeId,
      departmentId,
      fromDate,
      toDate,
      status
    );

    return res.status(200).json({
      success: true,
      message: "Attendance report fetched successfully",
      data: result.records,
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

export const exportAttendanceReportCsv = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const status = req.query.status as string | undefined;

    const csvData = await exportAttendanceReportCsvService(
      req.user!,
      employeeId,
      departmentId,
      fromDate,
      toDate,
      status
    );

    const filename = `attendance_report_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};

export const getLeaveReport = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const employeeId = req.query.employeeId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const leaveTypeId = req.query.leaveTypeId as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const result = await getLeaveReportService(
      req.user!,
      page,
      limit,
      employeeId,
      departmentId,
      leaveTypeId,
      status,
      fromDate,
      toDate
    );

    return res.status(200).json({
      success: true,
      message: "Leave report fetched successfully",
      data: result.records,
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

export const exportLeaveReportCsv = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.query.employeeId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const leaveTypeId = req.query.leaveTypeId as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const csvData = await exportLeaveReportCsvService(
      req.user!,
      employeeId,
      departmentId,
      leaveTypeId,
      status,
      fromDate,
      toDate
    );

    const filename = `leave_report_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
};
