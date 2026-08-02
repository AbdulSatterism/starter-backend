import express from 'express';
import { USER_ROLES } from '../../../enums/user';
import auth from '../../middlewares/auth';
import { authLimiter } from '../../middlewares/rateLimiters';
import validateRequest from '../../middlewares/validateRequest';
import { AuthController } from './auth.controller';
import { AuthValidation } from './auth.validation';
const router = express.Router();

router.post(
  '/login',
  authLimiter,
  validateRequest(AuthValidation.createLoginZodSchema),
  AuthController.loginUser,
);

router.post('/refresh-token', authLimiter, AuthController.newAccessToken);

router.post(
  '/forgot-password',
  authLimiter,
  validateRequest(AuthValidation.createForgetPasswordZodSchema),
  AuthController.forgetPassword,
);

router.post(
  '/verify-email',
  authLimiter,
  validateRequest(AuthValidation.createVerifyEmailZodSchema),
  AuthController.verifyEmail,
);

router.post('/resend-otp', authLimiter, AuthController.resendVerificationEmail);

router.post(
  '/reset-password',
  authLimiter,
  validateRequest(AuthValidation.createResetPasswordZodSchema),
  AuthController.resetPassword,
);

// router.delete(
//   '/delete-account',
//   auth(USER_ROLES.USER),
//   AuthController.deleteAccount
// );

router.post(
  '/change-password',
  authLimiter,
  auth(USER_ROLES.ADMIN, USER_ROLES.USER),
  validateRequest(AuthValidation.createChangePasswordZodSchema),
  AuthController.changePassword,
);

router.post('/google-login', AuthController.googleLogin);
router.post('/facebook-login', AuthController.facebookLogin);
router.post('/apple-login', AuthController.appleLogin);

export const AuthRoutes = router;
