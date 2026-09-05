import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text, attachments }) => {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
    attachments,
  });

  if (error) {
    throw new Error(error.message || "Failed to send email via Resend");
  }

  return {
    messageId: data.id,
    accepted: [to],
    rejected: [],
  };
};

export { sendEmail };
