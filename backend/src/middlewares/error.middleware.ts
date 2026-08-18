import {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../errors/app-error";

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code ?? "APPLICATION_ERROR",
      },
    });
  }

  if (err && typeof err.statusCode === "number") {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message || "Request failed",
      error: {
        code: err.code ?? "REQUEST_ERROR",
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: {
      code: "INTERNAL_SERVER_ERROR",
    },
  });
};