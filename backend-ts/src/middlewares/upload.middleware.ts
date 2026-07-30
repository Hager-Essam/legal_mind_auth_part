import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Request } from "express";
import multer from "multer";
import { env } from "../config/env";

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const allowedMimeTypes = new Map([
  [".pdf", new Set(["application/pdf"])],
  [".jpg", new Set(["image/jpeg"])],
  [".jpeg", new Set(["image/jpeg"])],
  [".png", new Set(["image/png"])],
]);

export const lawyerIdUploadDirectory = path.resolve(
  process.cwd(),
  env.lawyerIdUploadDir,
);

const storage = multer.diskStorage({
  destination: async (
    _req: Request,
    _file: Express.Multer.File,
    callback,
  ) => {
    try {
      await fs.mkdir(lawyerIdUploadDirectory, { recursive: true });
      callback(null, lawyerIdUploadDirectory);
    } catch (error) {
      callback(error as Error, lawyerIdUploadDirectory);
    }
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const nameWithoutExtension = path.basename(file.originalname, extension);
  const containsSecondExtension = /\.[a-z0-9]{1,8}$/i.test(nameWithoutExtension);
  const mimeTypes = allowedMimeTypes.get(extension);

  if (
    containsSecondExtension ||
    !allowedExtensions.has(extension) ||
    !mimeTypes?.has(file.mimetype.toLowerCase())
  ) {
    callback(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "lawyerIdDocument",
      ),
    );
    return;
  }
  callback(null, true);
};

export const lawyerIdUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Math.floor(env.lawyerIdMaxMb * 1024 * 1024), files: 1 },
});

export const removeUploadedFile = async (
  file: Express.Multer.File | undefined,
): Promise<void> => {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[Upload] Failed to remove orphaned lawyer ID file.");
    }
  }
};

