import { env } from "../config/env";
import { ILeaveRules } from "../models/leave-type.model";
import { IHoliday } from "../models/holiday.model";
import { getLocalDateString, isWeekendDay } from "./timezone.util";

export interface LeaveCalculationResult {
  days: number;
  totalCalendarDays: number;
  weekendDaysCount: number;
  holidayDaysCount: number;
  dates: string[]; // List of billable leave dates (YYYY-MM-DD)
  excludedDates: { date: string; reason: "WEEKEND" | "HOLIDAY" }[];
}

/**
 * Validates date string in YYYY-MM-DD format.
 */
export const isValidDateString = (dateStr: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

/**
 * Calculate leave days between fromDate and toDate (inclusive)
 * accounting for employee timezone, weekends, mandatory/optional holidays, and leave policy.
 */
export const calculateLeaveDays = (
  fromDate: string,
  toDate: string,
  rules: ILeaveRules,
  holidays: IHoliday[],
  weekendDaysConfig: string = env.ATTENDANCE_WEEKEND_DAYS
): LeaveCalculationResult => {
  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  if (fromDate > toDate) {
    throw new Error("From date cannot be after to date");
  }

  const weekendDays = weekendDaysConfig.split(",").map(Number);

  // Map active holidays by date
  const holidayMap = new Map<string, IHoliday>();
  for (const h of holidays) {
    if (h.status === "ACTIVE") {
      holidayMap.set(h.date, h);
    }
  }

  const billableDates: string[] = [];
  const excludedDates: { date: string; reason: "WEEKEND" | "HOLIDAY" }[] = [];
  let totalCalendarDays = 0;
  let weekendDaysCount = 0;
  let holidayDaysCount = 0;

  const [startY, startM, startD] = fromDate.split("-").map(Number);
  const [endY, endM, endD] = toDate.split("-").map(Number);

  let current = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));

  while (current <= end) {
    totalCalendarDays++;
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    const isWeekend = isWeekendDay(dateStr, weekendDays);
    const holiday = holidayMap.get(dateStr);

    let isExcluded = false;

    // Check weekend exclusion based on rules
    if (rules.excludeWeekends && isWeekend) {
      weekendDaysCount++;
      excludedDates.push({ date: dateStr, reason: "WEEKEND" });
      isExcluded = true;
    }

    // Check holiday exclusion based on rules
    if (!isExcluded && holiday) {
      const isMandatory = holiday.type === "MANDATORY";
      const isOptional = holiday.type === "OPTIONAL";

      const excludeMandatory = rules.excludeMandatoryHolidays && isMandatory;
      const excludeOptional = (rules as any).excludeOptionalHolidays && isOptional;

      if (excludeMandatory || excludeOptional) {
        holidayDaysCount++;
        excludedDates.push({ date: dateStr, reason: "HOLIDAY" });
        isExcluded = true;
      }
    }

    if (!isExcluded) {
      billableDates.push(dateStr);
    }

    // Advance by 1 day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    days: billableDates.length,
    totalCalendarDays,
    weekendDaysCount,
    holidayDaysCount,
    dates: billableDates,
    excludedDates,
  };
};

/**
 * Calculates calendar notice days between application date (in employee's timezone)
 * and the leave start date.
 */
export const calculateNoticeDays = (
  now: Date,
  employeeTimezone: string,
  fromDateStr: string
): number => {
  const localTodayStr = getLocalDateString(now, employeeTimezone);
  const [ty, tm, td] = localTodayStr.split("-").map(Number);
  const [fy, fm, fd] = fromDateStr.split("-").map(Number);

  const todayUtc = Date.UTC(ty, tm - 1, td);
  const fromUtc = Date.UTC(fy, fm - 1, fd);

  const diffMs = fromUtc - todayUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};
