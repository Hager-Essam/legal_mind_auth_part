const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  EMAIL_ALREADY_EXISTS: 'البريد الإلكتروني مستخدم بالفعل',
  UNAUTHORIZED: 'وصول غير مصرح به',
  TOKEN_EXPIRED: 'انتهت صلاحية الرمز',
  INVALID_TOKEN: 'رمز غير صالح',
  REFRESH_TOKEN_INVALID: 'رمز التحديث غير صالح',
  EMAIL_NOT_VERIFIED: 'يرجى تفعيل بريدك الإلكتروني قبل تسجيل الدخول',
  EMAIL_ALREADY_VERIFIED: 'تم تفعيل البريد الإلكتروني بالفعل',
  VERIFICATION_TOKEN_INVALID: 'رمز التفعيل غير صالح أو منتهي الصلاحية',

  // User
  USER_NOT_FOUND: 'المستخدم غير موجود',
  USER_ALREADY_EXISTS: 'المستخدم موجود بالفعل',

  // Validation
  VALIDATION_ERROR: 'خطأ في التحقق من البيانات',
  REQUIRED_FIELD: 'هذا الحقل مطلوب',
  INVALID_EMAIL: 'صيغة البريد الإلكتروني غير صحيحة',
  WEAK_PASSWORD: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وتحتوي على حرف كبير وحرف صغير ورقم',

  // Server
  INTERNAL_SERVER_ERROR: 'خطأ داخلي في الخادم',
  DATABASE_ERROR: 'حدث خطأ في قاعدة البيانات',
};

export default ERROR_MESSAGES;
