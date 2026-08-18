import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  approveLeaveService,
  cancelLeaveService,
  createLeaveRequestService,
  getLeaveRequestByIdService,
  getLeaveRequestsService,
  rejectLeaveService,
} from "../services/leave.service";

export const createLeaveRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leave = await createLeaveRequestService(
      req.body,
      req.user!,
      req
    );

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeaveRequests = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const employeeId = req.query.employeeId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const leaveTypeId = req.query.leaveTypeId as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const result = await getLeaveRequestsService(
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
      message: "Leave requests fetched successfully",
      data: result.leaves,
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

export const getLeaveRequestById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leave = await getLeaveRequestByIdService(
      req.params.id as string,
      req.user!
    );

    return res.status(200).json({
      success: true,
      message: "Leave request fetched successfully",
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

export const approveLeave = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leave = await approveLeaveService(
      req.params.id as string,
      req.user!,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Leave request approved successfully",
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectLeave = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leave = await rejectLeaveService(
      req.params.id as string,
      req.body?.rejectionReason,
      req.user!,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Leave request rejected successfully",
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelLeave = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const leave = await cancelLeaveService(
      req.params.id as string,
      req.body?.cancellationReason,
      req.user!,
      req
    );

    return res.status(200).json({
      success: true,
      message: "Leave request cancelled successfully",
      data: leave,
    });
  } catch (error) {
    next(error);
  }
};
