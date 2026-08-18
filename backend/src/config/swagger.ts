import swaggerJsdoc from "swagger-jsdoc";

const swaggerDefinition: swaggerJsdoc.SwaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Employee Leave & Attendance Management System API",
    version: "1.0.0",
    description:
      "Backend REST API for employee management, department structure, attendance tracking, and leave workflows.",
  },
  servers: [
    {
      url: "/api/v1",
      description: "Versioned API base path",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT Bearer Token header: 'Bearer <token>'",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string", example: "Something went wrong" },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "SOME_ERROR_CODE" },
            },
          },
        },
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 10 },
          total: { type: "integer", example: 100 },
          totalPages: { type: "integer", example: 10 },
        },
      },
      Employee: {
        type: "object",
        properties: {
          _id: { type: "string", example: "6612abf4c1a2b3d4e5f6a7b8" },
          employeeCode: { type: "string", example: "EMP-1042" },
          name: { type: "string", example: "Jayant Kaushik" },
          email: { type: "string", format: "email" },
          role: {
            type: "string",
            enum: ["EMPLOYEE", "MANAGER", "HR", "ADMIN"],
            example: "EMPLOYEE",
          },
          managerId: { type: "string", nullable: true },
          departmentId: { type: "string", nullable: true },
          joiningDate: { type: "string", format: "date-time" },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
            example: "ACTIVE",
          },
          timezone: { type: "string", example: "Asia/Kolkata" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Department: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", example: "Engineering" },
          managerId: { type: "string", nullable: true },
          status: {
            type: "string",
            enum: ["ACTIVE", "ARCHIVED"],
            example: "ACTIVE",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Attendance: {
        type: "object",
        properties: {
          _id: { type: "string" },
          employeeId: { type: "string" },
          date: { type: "string", example: "2026-08-18" },
          checkInAt: { type: "string", format: "date-time" },
          checkOutAt: { type: "string", format: "date-time", nullable: true },
          status: {
            type: "string",
            enum: ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "LEAVE"],
            example: "PRESENT",
          },
          timezone: { type: "string", example: "Asia/Kolkata" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LeaveType: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", example: "Annual Leave" },
          code: { type: "string", example: "AL" },
          annualQuota: { type: "number", example: 18 },
          rules: {
            type: "object",
            properties: {
              allowNegativeBalance: { type: "boolean", example: false },
              excludeWeekends: { type: "boolean", example: true },
              excludeMandatoryHolidays: { type: "boolean", example: true },
              allowHalfDay: { type: "boolean", example: false },
              allowCancellation: { type: "boolean", example: true },
              maxConsecutiveDays: { type: "number", example: 15 },
              minNoticeDays: { type: "number", example: 2 },
            },
          },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE"], example: "ACTIVE" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LeaveBalance: {
        type: "object",
        properties: {
          _id: { type: "string" },
          employeeId: { type: "string" },
          leaveTypeId: { type: "string" },
          year: { type: "integer", example: 2026 },
          allocated: { type: "number", example: 18 },
          used: { type: "number", example: 4 },
          available: { type: "number", example: 14 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      LeaveRequest: {
        type: "object",
        properties: {
          _id: { type: "string" },
          employeeId: { type: "string" },
          leaveTypeId: { type: "string" },
          fromDate: { type: "string", example: "2026-08-18" },
          toDate: { type: "string", example: "2026-08-20" },
          days: { type: "number", example: 3 },
          reason: { type: "string", example: "Vacation trip" },
          status: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
            example: "PENDING",
          },
          approvedBy: { type: "string", nullable: true },
          approvedAt: { type: "string", format: "date-time", nullable: true },
          rejectedBy: { type: "string", nullable: true },
          rejectedAt: { type: "string", format: "date-time", nullable: true },
          rejectionReason: { type: "string", nullable: true },
          cancelledBy: { type: "string", nullable: true },
          cancelledAt: { type: "string", format: "date-time", nullable: true },
          cancellationReason: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Holiday: {
        type: "object",
        properties: {
          _id: { type: "string" },
          date: { type: "string", example: "2026-08-15" },
          name: { type: "string", example: "Independence Day" },
          type: {
            type: "string",
            enum: ["MANDATORY", "OPTIONAL"],
            example: "MANDATORY",
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "INACTIVE"],
            example: "ACTIVE",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AuditLog: {
        type: "object",
        properties: {
          _id: { type: "string" },
          actorId: { type: "string" },
          action: { type: "string", example: "LEAVE_APPROVED" },
          entityType: { type: "string", example: "LeaveRequest" },
          entityId: { type: "string" },
          oldValue: { type: "object" },
          newValue: { type: "object" },
          metadata: { type: "object" },
          ipAddress: { type: "string" },
          userAgent: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);