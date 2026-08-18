import { Document, Schema, Types, model } from "mongoose";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ILeaveRequest extends Document {
  employeeId: Types.ObjectId;
  leaveTypeId: Types.ObjectId;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  days: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    leaveTypeId: {
      type: Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
      index: true,
    },
    fromDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "From date must be in YYYY-MM-DD format"],
    },
    toDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "To date must be in YYYY-MM-DD format"],
    },
    days: {
      type: Number,
      required: true,
      min: 0.5,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      required: true,
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ employeeId: 1, fromDate: 1, toDate: 1 });
leaveRequestSchema.index({ status: 1, fromDate: 1 });

export const LeaveRequest = model<ILeaveRequest>(
  "LeaveRequest",
  leaveRequestSchema
);
