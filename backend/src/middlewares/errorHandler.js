export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado',
    },
  });
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : 'Error interno del servidor';
  const isDev = process.env.NODE_ENV !== 'production';

  if (!err.isOperational) {
    const cleanErr = { ...err };
    if (cleanErr.sql && typeof cleanErr.sql === "string" && cleanErr.sql.length > 1000) {
      cleanErr.sql = cleanErr.sql.slice(0, 1000) + "... [SQL Truncado por tamaño]";
    }
    console.error('[FATAL] Error no operacional:', cleanErr);
  } else if (isDev) {
    console.error(`[${code}] ${err.message}`);
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
      ...(isDev && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(response);
}
