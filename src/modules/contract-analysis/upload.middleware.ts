import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from './contract-analysis.types';

const UPLOADS_DIR = path.join(__dirname, "../../../uploads");

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`));
    }
  },
});
