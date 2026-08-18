import { Document, Schema, model } from "mongoose";

export type HolidayType = "MANDATORY" | "OPTIONAL";
export type HolidayStatus = "ACTIVE" | "INACTIVE";

export interface IHoliday extends Document {
  date: string; // YYYY-MM-DD
  name: string;
  type: HolidayType;
  status: HolidayStatus;
  createdAt: Date;
  updatedAt: Date;
}

const holidaySchema = new Schema<IHoliday>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    type: {
      type: String,
      enum: ["MANDATORY", "OPTIONAL"],
      default: "MANDATORY",
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

holidaySchema.index({ date: 1, type: 1 });
holidaySchema.index({ status: 1 });

export const Holiday = model<IHoliday>("Holiday", holidaySchema);
