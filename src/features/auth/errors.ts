export class AuthError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'اسم المستخدم أو كلمة المرور غير صحيحة') {
    super(message, 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountLockedError extends AuthError {
  public readonly unlockAt?: string;

  constructor(
    message: string = 'تم قفل هذا الحساب مؤقتاً لتكرار محاولات الدخول الخاطئة. يرجى المحاولة لاحقاً أو التواصل مع مدير النظام.',
    unlockAt?: string
  ) {
    super(message, 'ACCOUNT_LOCKED');
    this.name = 'AccountLockedError';
    this.unlockAt = unlockAt;
  }
}

export class AccountInactiveError extends AuthError {
  constructor(message: string = 'هذا الحساب معطل حالياً. يرجى مراجعة إدارة المنشأة.') {
    super(message, 'ACCOUNT_INACTIVE');
    this.name = 'AccountInactiveError';
  }
}

export class UnauthorizedError extends AuthError {
  public readonly requiredPermission?: string;

  constructor(
    message: string = 'ليس لديك الصلاحيات الكافية لتنفيذ هذا الإجراء.',
    requiredPermission?: string
  ) {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
    this.requiredPermission = requiredPermission;
  }
}

export class ValidationError extends AuthError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
