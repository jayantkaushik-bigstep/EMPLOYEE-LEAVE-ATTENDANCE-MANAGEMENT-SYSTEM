import { ClientSession, Types } from "mongoose";
import { ILeaveRequest, LeaveRequest } from "../models/leave-request.model";

export const findLeaveRequestById = async (
  id: string,
  session?: ClientSession
): Promise<ILeaveRequest | null> => {
  const query = LeaveRequest.findById(id).populate(
    "employeeId",
    "name employeeCode email departmentId managerId timezone"
  ).populate("leaveTypeId", "name code rules annualQuota");

  if (session) {
    query.session(session);
  }
  return query;
};

export const findLeaveRequests = async (
  filter: Record<string, any>,
  skip: number = 0,
  limit: number = 10
) => {
  const [leaves, total] = await Promise.all([
    LeaveRequest.find(filter)
      .populate(
        "employeeId",
        "name employeeCode email departmentId managerId"
      )
      .populate("leaveTypeId", "name code")
      .populate("approvedBy", "name employeeCode email role")
      .populate("rejectedBy", "name employeeCode email role")
      .populate("cancelledBy", "name employeeCode email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);

  return { leaves, total };
};

export const findOverlappingLeaves = async (
  employeeId: string,
  fromDate: string,
  toDate: string,
  excludeLeaveId?: string,
  statuses: string[] = ["PENDING", "APPROVED"],
  session?: ClientSession
): Promise<ILeaveRequest[]> => {
  const filter: Record<string, any> = {
    employeeId: new Types.ObjectId(employeeId),
    status: { $in: statuses },
    $and: [
      { fromDate: { $lte: toDate } },
      { toDate: { $gte: fromDate } },
    ],
  };

  if (excludeLeaveId) {
    filter._id = { $ne: new Types.ObjectId(excludeLeaveId) };
  }

  const query = LeaveRequest.find(filter);
  if (session) {
    query.session(session);
  }
  return query;
};

export const createLeaveRequest = async (
  data: Partial<ILeaveRequest>,
  session?: ClientSession
): Promise<ILeaveRequest> => {
  if (session) {
    const docs = await LeaveRequest.create([data], { session });
    return docs[0];
  }
  return LeaveRequest.create(data);
};

export const updateLeaveRequest = async (
  id: string,
  data: Partial<ILeaveRequest>,
  session?: ClientSession
): Promise<ILeaveRequest | null> => {
  return LeaveRequest.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    ...(session ? { session } : {}),
  });
};
