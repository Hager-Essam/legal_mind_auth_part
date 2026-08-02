import type { ZodError, ZodIssue } from "zod";
import { HttpError } from "./http-error";

export type ValidationIssue = {
  field: string;
  message: string;
  code: string;
};

export type ValidationErrorDetails = {
  fields: Record<string, string[]>;
  issues: ValidationIssue[];
};

const fieldFromIssue = (issue: ZodIssue): string =>
  issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";

export const validationDetailsFromZod = (error: ZodError): ValidationErrorDetails => {
  const fields: Record<string, string[]> = {};
  const issues = error.issues.map((issue) => {
    const field = fieldFromIssue(issue);
    fields[field] ??= [];
    fields[field].push(issue.message);

    return {
      field,
      message: issue.message,
      code: issue.code,
    };
  });

  return { fields, issues };
};

export class RequestValidationError extends HttpError {
  constructor(error: ZodError) {
    const details = validationDetailsFromZod(error);
    const first = details.issues[0];
    const message = first
      ? first.field === "_form"
        ? first.message
        : `${first.field}: ${first.message}`
      : "The request contains invalid data.";
    super(400, message, details, "VALIDATION_ERROR");
  }
}
