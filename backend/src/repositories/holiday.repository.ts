import { Holiday, IHoliday } from "../models/holiday.model";

export const findHolidayById = async (id: string): Promise<IHoliday | null> => {
  return Holiday.findById(id);
};

export const findHolidayByDate = async (
  date: string
): Promise<IHoliday | null> => {
  return Holiday.findOne({ date });
};

export const findHolidaysInRange = async (
  fromDate: string,
  toDate: string,
  onlyActive: boolean = true
): Promise<IHoliday[]> => {
  const filter: Record<string, any> = {
    date: { $gte: fromDate, $lte: toDate },
  };
  if (onlyActive) {
    filter.status = "ACTIVE";
  }
  return Holiday.find(filter).sort({ date: 1 });
};

export const findHolidaysInYear = async (
  year: number,
  onlyActive: boolean = true
): Promise<IHoliday[]> => {
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;
  return findHolidaysInRange(fromDate, toDate, onlyActive);
};

export const findAllHolidays = async (
  filter: Record<string, any> = {},
  skip: number = 0,
  limit: number = 100
) => {
  const [holidays, total] = await Promise.all([
    Holiday.find(filter).sort({ date: 1 }).skip(skip).limit(limit),
    Holiday.countDocuments(filter),
  ]);
  return { holidays, total };
};

export const createHoliday = async (
  data: Partial<IHoliday>
): Promise<IHoliday> => {
  return Holiday.create(data);
};

export const updateHoliday = async (
  id: string,
  data: Partial<IHoliday>
): Promise<IHoliday | null> => {
  return Holiday.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

export const deleteHoliday = async (id: string): Promise<IHoliday | null> => {
  return Holiday.findByIdAndDelete(id);
};
