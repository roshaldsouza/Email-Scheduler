import nodemailer from "nodemailer";

export type MailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

let transporter: nodemailer.Transporter | null = null;

export async function getTransporter() {
  if (transporter) return transporter;

  // Create ethereal test account
  const testAccount = await nodemailer.createTestAccount();

  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log("📩 Ethereal SMTP ready");
  console.log("   user:", testAccount.user);
  console.log("   pass:", testAccount.pass);

  return transporter;
}

export async function sendMail(payload: MailPayload) {
  const t = await getTransporter();

  const info = await t.sendMail({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { info, previewUrl };
}
