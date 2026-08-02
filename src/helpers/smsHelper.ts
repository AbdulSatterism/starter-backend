import { enqueueSms } from '../queues/queueManager';

export type SmsOtpPayload = {
  to: string;
  name?: string;
  otp: number;
  type: 'VERIFY' | 'RESET';
};

export const sendOtpSms = async (payload: SmsOtpPayload) => {
  const message =
    payload.type === 'VERIFY'
      ? `Hi ${payload.name || 'there'}, your verification code is ${payload.otp}. It expires in 20 minutes.`
      : `Hi ${payload.name || 'there'}, your password reset code is ${payload.otp}. It expires in 20 minutes.`;

  return enqueueSms({
    to: payload.to,
    message,
    meta: payload,
  });
};
