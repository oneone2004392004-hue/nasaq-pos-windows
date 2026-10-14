/**
 * Database Layer Errors
 * Structured errors distinguishing between constraint violations, not found, validation, and general database errors.
 */

export class DatabaseError extends Error {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public readonly fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConstraintError extends DatabaseError {
  constructor(message: string, public readonly constraintType?: 'FOREIGN_KEY' | 'UNIQUE' | 'NOT_NULL' | 'CHECK') {
    super(message);
    this.name = 'ConstraintError';
    Object.setPrototypeOf(this, ConstraintError.prototype);
  }
}

export class ConflictError extends ConstraintError {
  constructor(message: string) {
    super(message, 'UNIQUE');
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class NotFoundError extends DatabaseError {
  public readonly entityName: string;
  public readonly identifier?: string;

  constructor(entityNameOrMessage: string, identifier?: string) {
    if (identifier !== undefined) {
      super(`${entityNameOrMessage} with id "${identifier}" was not found.`);
      this.entityName = entityNameOrMessage;
      this.identifier = identifier;
    } else {
      super(entityNameOrMessage);
      this.entityName = entityNameOrMessage;
    }
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Maps raw SQLite engine error messages into typed domain DatabaseError exceptions
 */
export function wrapSqliteError(error: unknown): Error {
  if (error instanceof DatabaseError) {
    return error;
  }
  if (error instanceof Error && (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError' || error.name === 'AuthenticationError')) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('FOREIGN KEY constraint failed')) {
    return new ConstraintError(`فشل قيد المفتاح الأجنبي: تعذر تنفيذ العملية لأن السجل المرتبط غير موجود أو مرتبط ببيانات أخرى`, 'FOREIGN_KEY');
  }

  if (message.includes('UNIQUE constraint failed')) {
    const fieldMatch = message.match(/UNIQUE constraint failed:\s*([^\s]+)/);
    const field = fieldMatch ? fieldMatch[1] : '';
    return new ConflictError(`قيمة مكررة غير مسموح بها: السجل موجود بالفعل (${field || 'قيد التفرد'})`);
  }

  if (message.includes('NOT NULL constraint failed')) {
    return new ConstraintError(`حقل إجباري فارغ: ${message}`, 'NOT_NULL');
  }

  if (message.includes('CHECK constraint failed')) {
    return new ConstraintError(`فشل قيد التحقق من صحة القيمة: ${message}`, 'CHECK');
  }

  return new DatabaseError(`خطأ في قاعدة بيانات SQLite: ${message}`, error);
}
