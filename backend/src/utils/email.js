import 'dotenv/config';
import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
let cachedInlineAssets = null;

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

const getInlineAssets = () => {
  if (cachedInlineAssets) {
    return cachedInlineAssets;
  }

  const logoPath = path.resolve(currentDirPath, '../../../frontend/public/logo.png');

  cachedInlineAssets = {
    logo: fs.existsSync(logoPath)
      ? {
          filename: 'aiqda-logo.png',
          path: logoPath,
          cid: 'aiqda-logo',
          contentType: 'image/png',
          contentDisposition: 'inline',
        }
      : null,
  };

  return cachedInlineAssets;
};

const getDefaultInlineAttachments = (html, attachments = []) => {
  if (!html || typeof html !== 'string') {
    return attachments;
  }

  const normalizedAttachments = Array.isArray(attachments) ? [...attachments] : [];
  const assets = getInlineAssets();

  if (
    html.includes('cid:aiqda-logo')
    && assets.logo
    && !normalizedAttachments.some((attachment) => attachment?.cid === 'aiqda-logo')
  ) {
    normalizedAttachments.push(assets.logo);
  }

  return normalizedAttachments;
};

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

export const sendEmail = async ({ to, subject, text, html, replyTo, attachments = [] }) => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || (!isProduction() ? 'Aiqda <no-reply@aiqda.local>' : null);
  if (!from) {
    throw new Error('Email is not configured. Set EMAIL_FROM or SMTP_USER.');
  }

  const transport = getTransporter();
  const resolvedAttachments = getDefaultInlineAttachments(html, attachments);
  const info = await transport.sendMail({
    from,
    to,
    replyTo,
    subject,
    text,
    html,
    attachments: resolvedAttachments,
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
