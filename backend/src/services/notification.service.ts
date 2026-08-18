import { ILeaveRequest } from "../models/leave-request.model";
import { IEmployee } from "../models/employee.model";

export interface INotificationService {
  notifyLeaveCreated(
    leaveRequest: ILeaveRequest,
    employee: IEmployee
  ): Promise<void>;

  notifyLeaveApproved(
    leaveRequest: ILeaveRequest,
    employee: IEmployee,
    approver: IEmployee
  ): Promise<void>;

  notifyLeaveRejected(
    leaveRequest: ILeaveRequest,
    employee: IEmployee,
    rejector: IEmployee,
    reason?: string
  ): Promise<void>;

  notifyLeaveCancelled(
    leaveRequest: ILeaveRequest,
    employee: IEmployee,
    canceller: IEmployee
  ): Promise<void>;
}

export class MockConsoleNotificationService implements INotificationService {
  async notifyLeaveCreated(
    leaveRequest: ILeaveRequest,
    employee: IEmployee
  ): Promise<void> {
    console.log(
      `[NOTIFICATION] Leave Request Created: Employee ${employee.name} (${employee.employeeCode}) requested ${leaveRequest.days} day(s) from ${leaveRequest.fromDate} to ${leaveRequest.toDate}. Reason: ${leaveRequest.reason}`
    );
  }

  async notifyLeaveApproved(
    leaveRequest: ILeaveRequest,
    employee: IEmployee,
    approver: IEmployee
  ): Promise<void> {
    console.log(
      `[NOTIFICATION] Leave Request Approved: Request ${leaveRequest._id} for ${employee.name} approved by ${approver.name} (${approver.role}).`
    );
  }

  async notifyLeaveRejected(
    leaveRequest: ILeaveRequest,
    employee: IEmployee,
    rejector: IEmployee,
    reason?: string
  ): Promise<void> {
    console.log(
      `[NOTIFICATION] Leave Request Rejected: Request ${leaveRequest._id} for ${employee.name} rejected by ${rejector.name}. Reason: ${reason ?? "N/A"}`
    );
  }

  async notifyLeaveCancelled(
    leaveRequest: ILeaveRequest,
    employee: IEmployee,
    canceller: IEmployee
  ): Promise<void> {
    console.log(
      `[NOTIFICATION] Leave Request Cancelled: Request ${leaveRequest._id} for ${employee.name} cancelled by ${canceller.name}.`
    );
  }
}

// Export a singleton instance. This can easily be swapped with an Email/SMS implementation.
export const notificationService: INotificationService =
  new MockConsoleNotificationService();
