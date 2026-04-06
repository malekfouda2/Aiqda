import 'dotenv/config';
import nodemailer from 'nodemailer';

const isProduction = () => process.env.NODE_ENV === 'production';

const getSmtpConfig = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
});

const hasSmtpConfig = () => {
  const smtpConfig = getSmtpConfig();
  return Boolean(
    smtpConfig.host &&
    smtpConfig.port &&
    smtpConfig.user &&
    smtpConfig.pass
  );
};

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (hasSmtpConfig()) {
    const smtpConfig = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });
    return transporter;
  }

  if (isProduction()) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM.');
  }

  transporter = nodemailer.createTransport({
    buffer: true,
    newline: 'unix',
    streamTransport: true,
  });
  return transporter;
};

export const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || (!isProduction() ? 'Aiqda <no-reply@aiqda.local>' : null);
  if (!from) {
    throw new Error('Email is not configured. Set EMAIL_FROM or SMTP_USER.');
  }

  const transport = getTransporter();
  const info = await transport.sendMail({
    from,
    to,
    replyTo,
    subject,
    text,
    html,
  });

  const usedPreviewTransport = !hasSmtpConfig();
  if (usedPreviewTransport && info.message) {
    console.log('Email preview:\n%s', info.message.toString());
  }

  return {
    messageId: info.messageId || null,
    usedPreviewTransport,
  };
};
