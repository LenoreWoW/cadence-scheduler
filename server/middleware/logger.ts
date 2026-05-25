/**
 * Request Logger Middleware
 */

import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 500 ? '\x1b[31m' : // Red
                        res.statusCode >= 400 ? '\x1b[33m' : // Yellow
                        res.statusCode >= 300 ? '\x1b[36m' : // Cyan
                        '\x1b[32m'; // Green

    // Strip query string — OAuth callbacks carry live `?code=...` / `?state=...`
    // credentials and we don't want them in logs.
    const pathOnly = req.originalUrl.split('?')[0];

    console.log(
      `${statusColor}${req.method}\x1b[0m ${pathOnly} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
}

