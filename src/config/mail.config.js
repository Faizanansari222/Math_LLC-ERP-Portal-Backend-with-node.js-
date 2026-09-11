import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, text, attachments }) => {
  let data, error;

  try {
    ({ data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
      attachments,
    }));
  } catch (networkError) {
    // The Resend SDK itself throwing (network/DNS/timeout) rather than
    // resolving with { error } — log it the same way so it's just as
    // visible as an API-level rejection.
    console.error(
      `[Resend] Send threw for to="${to}" subject="${subject}":`,
      networkError,
    );
    throw new Error(
      `Failed to send email to ${to}: ${networkError.message || "network error contacting Resend"}`,
    );
  }

  if (error) {
    // Log the full provider error — status code, error name, and message —
    // plus who it was going to, right where the failure actually happens.
    // This is what makes a rejected send (e.g. a sandbox/domain
    // restriction, invalid recipient, etc.) show up in server logs
    // instead of just being a string bubbled up to whichever call site
    // catches it.
    console.error(`[Resend] Send failed for to="${to}" subject="${subject}":`, {
      statusCode: error.statusCode,
      name: error.name,
      message: error.message,
    });
    const err = new Error(
      `Failed to send email to ${to}: ${error.message || "Resend rejected the request"}`,
    );
    err.statusCode = error.statusCode;
    err.resendErrorName = error.name;
    throw err;
  }

  return {
    messageId: data.id,
    accepted: [to],
    rejected: [],
  };
};

export { sendEmail };
