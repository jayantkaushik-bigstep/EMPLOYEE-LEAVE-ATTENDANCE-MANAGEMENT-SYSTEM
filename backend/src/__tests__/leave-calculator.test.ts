import {
  calculateLeaveDays,
  calculateNoticeDays,
  isValidDateString,
} from "../utils/leave-calculator.util";
import { ILeaveRules } from "../models/leave-type.model";
import { IHoliday } from "../models/holiday.model";

describe("Leave Calculator Utility", () => {
  const defaultRules: ILeaveRules = {
    allowNegativeBalance: false,
    excludeWeekends: true,
    excludeMandatoryHolidays: true,
    allowHalfDay: false,
    allowCancellation: true,
    maxConsecutiveDays: 15,
    minNoticeDays: 2,
  };

  test("validates date format correctly", () => {
    expect(isValidDateString("2026-08-15")).toBe(true);
    expect(isValidDateString("2026-02-29")).toBe(false); // 2026 is not a leap year
    expect(isValidDateString("invalid")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
  });

  test("calculates leave days with holiday and weekend exclusion (Prompt Example)", () => {
    // 15 Aug 2026 -> 18 Aug 2026
    // 15 Aug 2026: Saturday (or Holiday)
    // 16 Aug 2026: Sunday
    // 17 Aug 2026: Monday
    // 18 Aug 2026: Tuesday
    // In our test, let's set 15 Aug as Holiday, 16 Aug as Sunday, and assume weekend is Sat,Sun (0,6).
    // Let's test explicit dates: 2026-08-14 (Fri = holiday), 2026-08-15 (Sat = weekend), 2026-08-16 (Sun = weekend), 2026-08-17 (Mon = working day)
    const holidays = [
      {
        date: "2026-08-14",
        name: "Independence Day Observance",
        type: "MANDATORY",
        status: "ACTIVE",
      } as IHoliday,
    ];

    const result = calculateLeaveDays(
      "2026-08-14",
      "2026-08-17",
      defaultRules,
      holidays,
      "0,6"
    );

    // Fri (Holiday), Sat (Weekend), Sun (Weekend), Mon (Working)
    expect(result.totalCalendarDays).toBe(4);
    expect(result.holidayDaysCount).toBe(1);
    expect(result.weekendDaysCount).toBe(2);
    expect(result.days).toBe(1);
    expect(result.dates).toEqual(["2026-08-17"]);
  });

  test("does not exclude weekends if policy excludeWeekends = false", () => {
    const rules: ILeaveRules = {
      ...defaultRules,
      excludeWeekends: false,
      excludeMandatoryHolidays: false,
    };

    const result = calculateLeaveDays(
      "2026-08-15",
      "2026-08-17",
      rules,
      [],
      "0,6"
    );

    expect(result.days).toBe(3);
  });

  test("excludes optional holidays only if policy specifies", () => {
    const holidays = [
      {
        date: "2026-08-17",
        name: "Optional Festival",
        type: "OPTIONAL",
        status: "ACTIVE",
      } as IHoliday,
    ];

    // Default policy does not exclude optional holidays
    const result1 = calculateLeaveDays(
      "2026-08-17",
      "2026-08-18",
      defaultRules,
      holidays,
      "0,6"
    );
    expect(result1.days).toBe(2);

    // Policy with excludeOptionalHolidays = true
    const result2 = calculateLeaveDays(
      "2026-08-17",
      "2026-08-18",
      { ...defaultRules, excludeOptionalHolidays: true } as any,
      holidays,
      "0,6"
    );
    expect(result2.days).toBe(1);
  });

  test("throws error if fromDate > toDate", () => {
    expect(() =>
      calculateLeaveDays("2026-08-20", "2026-08-15", defaultRules, [])
    ).toThrow("From date cannot be after to date");
  });

  test("calculates notice days correctly", () => {
    const baseDate = new Date("2026-08-10T10:00:00.000Z");
    const timezone = "Asia/Kolkata";

    expect(calculateNoticeDays(baseDate, timezone, "2026-08-15")).toBe(5);
    expect(calculateNoticeDays(baseDate, timezone, "2026-08-10")).toBe(0);
    expect(calculateNoticeDays(baseDate, timezone, "2026-08-08")).toBe(-2);
  });
});
