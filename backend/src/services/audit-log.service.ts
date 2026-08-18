import { Request } from "express";
import { Types } from "mongoose";
import { createAuditLogEntry } from "../repositories/audit-log.repository";

interface AuditLogOptions {
  actorId: Types.ObjectId | string;
  action: string;
  entityType: string;
  entityId: Types.ObjectId | string;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
  req?: Request;
  ipAddress?: string;
  userAgent?: string;
}

const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;

  if (obj instanceof Date || obj instanceof Types.ObjectId) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, any> = {};
  const secretKeys = [
    "password",
    "passwordhash",
    "token",
    "secret",
    "authorization",
    "jwt_secret",
  ];

  for (const [key, value] of Object.entries(
    obj.toObject ? obj.toObject() : obj
  )) {
    if (secretKeys.includes(key.toLowerCase())) {
      continue; // Skip secret fields
    }
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
};

export const recordAuditLog = async (options: AuditLogOptions) => {
  try {
    const ipAddress =
      options.ipAddress ||
      options.req?.ip ||
      (options.req?.headers["x-forwarded-for"] as string) ||
      options.req?.socket?.remoteAddress;

    const userAgent =
      options.userAgent ||
      (options.req?.headers["user-agent"] as string) ||
      undefined;

    await createAuditLogEntry({
      actorId: new Types.ObjectId(String(options.actorId)),
      action: options.action,
      entityType: options.entityType,
      entityId: new Types.ObjectId(String(options.entityId)),
      oldValue: sanitizeObject(options.oldValue),
      newValue: sanitizeObject(options.newValue),
      metadata: sanitizeObject(options.metadata),
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Log error but don't disrupt primary business flow
    console.error("Failed to record audit log:", error);
  }
};
