import express from 'express';
import userController from './user.controller';
import validate from '../../middlewares/validation.middleware';
import { authenticate } from '../auth/auth.middleware';
import { updateProfileSchema } from './user.validator';
import avatarUpload from '../../middlewares/avatar-upload.middleware';

const router = express.Router();

router.patch('/profile', authenticate, validate(updateProfileSchema), userController.updateProfile);
router.post('/profile/avatar', authenticate, avatarUpload.single('avatar'), userController.uploadAvatar);

export default router;
