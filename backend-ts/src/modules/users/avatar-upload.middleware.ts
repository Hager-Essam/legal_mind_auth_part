import type { RequestHandler } from "express";
import multer from "multer";
import { AVATAR_CONTENT_TYPES } from "../../infrastructure/storage/avatar-storage.service";
import { HttpError } from "../../shared/http/http-error";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_request, file, callback) => {
    if (AVATAR_CONTENT_TYPES.includes(file.mimetype as never)) {
      callback(null, true);
      return;
    }
    callback(
      new HttpError(
        400,
        "Avatar must be a JPEG, PNG, or WebP image. يجب أن تكون الصورة من نوع JPEG, PNG, أو WebP.",
        undefined,
        "AVATAR_TYPE_INVALID"
      )
    );
  },
});

export const avatarUploadMiddleware: RequestHandler = (request, response, next) => {
  upload.single("avatar")(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      next(
        new HttpError(
          400,
          error.code === "LIMIT_FILE_SIZE"
            ? "Avatar must not exceed 2 MB. يجب أن لا تتجاوز حجم الصورة 2 ميجابايت."
            : "تحميل الصورة الشخصية غير صالح. يجب أن تكون الصورة من نوع JPEG, PNG, أو WebP.",
          { upload_code: error.code },
          error.code === "LIMIT_FILE_SIZE" ? "AVATAR_TOO_LARGE" : "AVATAR_UPLOAD_INVALID"
        )
      );
      return;
    }
    next(error);
  });
};
