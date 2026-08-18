import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "../errors/app-error";

export const validate = (schema: ZodSchema) => {
  return (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      return next(
        new AppError(
          "Validation failed",
          400,
          "VALIDATION_FAILED"
        )
      );
    }

    req.body = result.data;

    next();
  };
};