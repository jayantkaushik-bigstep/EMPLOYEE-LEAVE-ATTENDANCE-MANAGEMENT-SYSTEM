import { Types } from "mongoose";
import { AuditLog, IAuditLog } from "../models/audit-log.model";

export const createAuditLogEntry = async (
  data: Partial<IAuditLog>
): Promise<IAuditLog> => {
  return AuditLog.create(data);
};

export const findAuditLogs = async (
  filter: Record<string, any>,
  skip: number = 0,
  limit: number = 20
) => {
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorId", "name employeeCode email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, total };
};
