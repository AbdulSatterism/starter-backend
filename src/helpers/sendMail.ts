import { StatusCodes } from 'http-status-codes';
import AppError from '../app/errors/AppError';
import { sendTextMailDirect } from '../shared/mailTransport';

export async function sendEmail(email: string, subject: string, text: string) {
  try {
    return await sendTextMailDirect(email, subject, text);
  } catch (error) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Error sending email',
    );
  }
}
