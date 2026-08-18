import { Types } from "mongoose";
import { Attendance } from "../models/attendance.model";
import { LeaveRequest } from "../models/leave-request.model";

export interface AttendanceReportFilter {
  employeeIds?: Types.ObjectId[];
  employeeId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  fromDate?: string;
  toDate?: string;
  status?: string;
}

export interface LeaveReportFilter {
  employeeIds?: Types.ObjectId[];
  employeeId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  leaveTypeId?: Types.ObjectId;
  status?: string;
  fromDate?: string;
  toDate?: string;
}

export const aggregateAttendanceReport = async (
  filter: AttendanceReportFilter,
  skip: number = 0,
  limit: number = 20
) => {
  const matchStage: Record<string, any> = {};

  if (filter.employeeId) {
    matchStage.employeeId = filter.employeeId;
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    matchStage.employeeId = { $in: filter.employeeIds };
  }

  if (filter.status) {
    matchStage.status = filter.status;
  }

  if (filter.fromDate || filter.toDate) {
    matchStage.date = {};
    if (filter.fromDate) matchStage.date.$gte = filter.fromDate;
    if (filter.toDate) matchStage.date.$lte = filter.toDate;
  }

  const pipeline: any[] = [{ $match: matchStage }];

  pipeline.push(
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: "$employee" }
  );

  if (filter.departmentId) {
    pipeline.push({
      $match: { "employee.departmentId": filter.departmentId },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "departments",
        localField: "employee.departmentId",
        foreignField: "_id",
        as: "department",
      },
    },
    {
      $unwind: {
        path: "$department",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        workingHours: {
          $cond: [
            { $and: ["$checkInAt", "$checkOutAt"] },
            {
              $round: [
                {
                  $divide: [
                    { $subtract: ["$checkOutAt", "$checkInAt"] },
                    1000 * 60 * 60,
                  ],
                },
                2,
              ],
            },
            0,
          ],
        },
        isLate: { $eq: ["$status", "LATE"] },
      },
    }
  );

  const facetPipeline: any = {
    totalCount: [{ $count: "count" }],
  };

  if (limit > 0) {
    facetPipeline.data = [
      { $sort: { date: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          date: 1,
          checkIn: "$checkInAt",
          checkOut: "$checkOutAt",
          status: 1,
          workingHours: 1,
          isLate: 1,
          timezone: 1,
          employee: {
            _id: "$employee._id",
            name: "$employee.name",
            employeeCode: "$employee.employeeCode",
            email: "$employee.email",
            departmentId: "$employee.departmentId",
            departmentName: "$department.name",
            managerId: "$employee.managerId",
          },
        },
      },
    ];
  } else {
    // Export all records without pagination
    facetPipeline.data = [
      { $sort: { date: -1, createdAt: -1 } },
      {
        $project: {
          _id: 1,
          date: 1,
          checkIn: "$checkInAt",
          checkOut: "$checkOutAt",
          status: 1,
          workingHours: 1,
          isLate: 1,
          timezone: 1,
          employee: {
            _id: "$employee._id",
            name: "$employee.name",
            employeeCode: "$employee.employeeCode",
            email: "$employee.email",
            departmentId: "$employee.departmentId",
            departmentName: "$department.name",
            managerId: "$employee.managerId",
          },
        },
      },
    ];
  }

  pipeline.push({ $facet: facetPipeline });

  const result = await Attendance.aggregate(pipeline);
  const data = result[0]?.data || [];
  const total = result[0]?.totalCount[0]?.count || 0;

  return { data, total };
};

export const aggregateLeaveReport = async (
  filter: LeaveReportFilter,
  skip: number = 0,
  limit: number = 20
) => {
  const matchStage: Record<string, any> = {};

  if (filter.employeeId) {
    matchStage.employeeId = filter.employeeId;
  } else if (filter.employeeIds && filter.employeeIds.length > 0) {
    matchStage.employeeId = { $in: filter.employeeIds };
  }

  if (filter.leaveTypeId) {
    matchStage.leaveTypeId = filter.leaveTypeId;
  }

  if (filter.status) {
    matchStage.status = filter.status;
  }

  if (filter.fromDate || filter.toDate) {
    if (filter.fromDate && filter.toDate) {
      matchStage.$and = [
        { fromDate: { $lte: filter.toDate } },
        { toDate: { $gte: filter.fromDate } },
      ];
    } else if (filter.fromDate) {
      matchStage.toDate = { $gte: filter.fromDate };
    } else if (filter.toDate) {
      matchStage.fromDate = { $lte: filter.toDate };
    }
  }

  const pipeline: any[] = [{ $match: matchStage }];

  pipeline.push(
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: "$employee" }
  );

  if (filter.departmentId) {
    pipeline.push({
      $match: { "employee.departmentId": filter.departmentId },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "departments",
        localField: "employee.departmentId",
        foreignField: "_id",
        as: "department",
      },
    },
    {
      $unwind: {
        path: "$department",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "leavetypes",
        localField: "leaveTypeId",
        foreignField: "_id",
        as: "leaveType",
      },
    },
    {
      $unwind: {
        path: "$leaveType",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "employees",
        localField: "approvedBy",
        foreignField: "_id",
        as: "approver",
      },
    },
    {
      $unwind: {
        path: "$approver",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  const facetPipeline: any = {
    totalCount: [{ $count: "count" }],
  };

  if (limit > 0) {
    facetPipeline.data = [
      { $sort: { fromDate: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          fromDate: 1,
          toDate: 1,
          days: 1,
          reason: 1,
          status: 1,
          rejectionReason: 1,
          cancellationReason: 1,
          approvedAt: 1,
          rejectedAt: 1,
          cancelledAt: 1,
          createdAt: 1,
          employee: {
            _id: "$employee._id",
            name: "$employee.name",
            employeeCode: "$employee.employeeCode",
            email: "$employee.email",
            departmentId: "$employee.departmentId",
            departmentName: "$department.name",
          },
          leaveType: {
            _id: "$leaveType._id",
            name: "$leaveType.name",
            code: "$leaveType.code",
          },
          approver: {
            _id: "$approver._id",
            name: "$approver.name",
            employeeCode: "$approver.employeeCode",
            role: "$approver.role",
          },
        },
      },
    ];
  } else {
    facetPipeline.data = [
      { $sort: { fromDate: -1, createdAt: -1 } },
      {
        $project: {
          _id: 1,
          fromDate: 1,
          toDate: 1,
          days: 1,
          reason: 1,
          status: 1,
          rejectionReason: 1,
          cancellationReason: 1,
          approvedAt: 1,
          rejectedAt: 1,
          cancelledAt: 1,
          createdAt: 1,
          employee: {
            _id: "$employee._id",
            name: "$employee.name",
            employeeCode: "$employee.employeeCode",
            email: "$employee.email",
            departmentId: "$employee.departmentId",
            departmentName: "$department.name",
          },
          leaveType: {
            _id: "$leaveType._id",
            name: "$leaveType.name",
            code: "$leaveType.code",
          },
          approver: {
            _id: "$approver._id",
            name: "$approver.name",
            employeeCode: "$approver.employeeCode",
            role: "$approver.role",
          },
        },
      },
    ];
  }

  pipeline.push({ $facet: facetPipeline });

  const result = await LeaveRequest.aggregate(pipeline);
  const data = result[0]?.data || [];
  const total = result[0]?.totalCount[0]?.count || 0;

  return { data, total };
};
