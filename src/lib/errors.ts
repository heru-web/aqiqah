/**
 * AppError — error terstruktur dengan kode mesin yang stabil.
 * Digunakan di seluruh service layer; UI membaca `.code` + `.message`
 * (jangan pernah menampilkan pesan internal). HTTP status dipetakan
 * dari kode di route handlers.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INVALID_OPERATION"
  | "RATE_LIMITED"
  | "WEBHOOK_INVALID_SIGNATURE"
  | "WEBHOOK_ALREADY_PROCESSED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly expose: boolean;
  readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { expose?: boolean; details?: unknown }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.expose = options?.expose ?? true;
    this.details = options?.details;
  }

  static is(err: unknown): err is AppError {
    return err instanceof AppError;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Anda belum masuk.") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki izin untuk aksi ini.") {
    super("FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan.") {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Data sudah ada / bertentangan.") {
    super("CONFLICT", message);
  }
}

export class InvalidOperationError extends AppError {
  constructor(message = "Operasi tidak valid pada kondisi saat ini.", details?: unknown) {
    super("INVALID_OPERATION", message, { details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Data tidak valid.", details?: unknown) {
    super("VALIDATION_ERROR", message, { details });
  }
}

export function assertNever(value: never, message = "Nilai tidak dikenali."): never {
  throw new InvalidOperationError(message, { value });
}