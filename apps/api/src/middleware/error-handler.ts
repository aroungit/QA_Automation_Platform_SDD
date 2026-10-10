import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiResponse } from '@qaa/shared';
import {
  LLMConfigurationError,
  LLMError,
  LLMParseError,
  LLMRequestError,
} from '../providers/types.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
    },
  };
  res.status(404).json(response);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected internal error occurred';
  let details: unknown = undefined;

  if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed for request';
    details = err.issues;
  } else if (err instanceof LLMConfigurationError) {
    status = 400;
    code = err.code;
    message = err.message;
    details = { provider: err.provider };
  } else if (err instanceof LLMRequestError) {
    status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof LLMParseError) {
    status = 502;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof LLMError) {
    status = 500;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof Error) {
    message = err.message;
    if ('status' in err && typeof (err as { status?: unknown }).status === 'number') {
      status = (err as { status: number }).status;
    }
  }

  const response: ApiResponse<never> = {
    success: false,
    error: {
      message,
      code,
      details,
    },
  };

  res.status(status).json(response);
};
