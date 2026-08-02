import nodemailer from 'nodemailer';
import config from '../config';
import { errorLogger, logger } from './logger';
import { ISendEmail } from '../types/email';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: Number(config.email.port),
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

const sendMailDirect = async (values: ISendEmail) => {
  try {
    const info = await transporter.sendMail({
      from: `"abdul-satter" ${config.email.from}`,
      to: values.to,
      subject: values.subject,
      html: values.html,
    });

    logger.info('Mail send successfully', info.accepted);
    return info;
  } catch (error) {
    errorLogger.error('Email', error);
    throw error;
  }
};

const sendTextMailDirect = async (
  email: string,
  subject: string,
  text: string,
) => {
  const info = await transporter.sendMail({
    from: `"abdul-satter" ${config.email.from}`,
    to: email,
    subject,
    text,
    html: text,
  });

  logger.info('Mail send successfully', info.accepted);
  return info;
};

export { sendMailDirect, sendTextMailDirect, transporter };
