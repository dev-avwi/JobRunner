import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

/**
 * Global Express error middleware.
 *
 * Lifted verbatim from the inline `app.use((err, req, res, next) => …)` that
 * previously lived at `server/routes.ts:48693`. Behaviour, status codes,
 * Sentry capture, structured log shape and JSON response keys are preserved
 * so any log-based alerting and any existing client code keeps working.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const statusCode = err.status || err.statusCode || 500;
  const requestId = req.headers['x-request-id'] || randomUUID().substring(0, 8);

  if (statusCode >= 500) {
    Sentry.captureException(err);
  }

  const logCtx = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode,
    err,
    userId: (req as any).session?.userId || 'anonymous',
  };

  if (statusCode >= 500) {
    logger.error(logCtx, err.message || 'Internal server error');
  } else {
    logger.warn(logCtx, err.message || 'Client error');
  }

  if (!res.headersSent) {
    const safeMessage = statusCode >= 500
      ? 'Internal server error'
      : (err.message || 'Internal server error');

    res.status(statusCode).json({
      error: safeMessage,
      requestId,
    });
  }
}

/**
 * 404 handler for unmatched `/api/*` requests. Mounted after all `/api`
 * routes but before the Vite SPA catch-all so that deep-link SPA paths still
 * resolve to `index.html` while unknown API paths surface as a structured
 * JSON 404 instead of an HTML document.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
}
