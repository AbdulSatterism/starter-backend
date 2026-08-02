import { enqueueEmail } from '../queues/queueManager';
import { sendMailDirect } from '../shared/mailTransport';
import { ISendEmail } from '../types/email';

const sendEmail = async (values: ISendEmail) => {
  return enqueueEmail(values);
};

export const emailHelper = {
  sendEmail,
  sendMailDirect,
};
