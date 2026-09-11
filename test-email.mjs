// TEMPORARY isolated email deliverability test — bypasses all business
// logic (invitations, password reset, etc.) and calls the real
// sendEmail() used by the app directly, so we can see the raw Resend
// response. Delete this file once debugging is done.
import "dotenv/config";
import { sendEmail } from "./src/config/mail.config.js";

const testRecipient = process.argv[2];

if (!testRecipient) {
  console.error("Usage: node test-email.mjs <recipient-email>");
  process.exit(1);
}

console.log("--- Env check (no secrets printed) ---");
console.log("RESEND_API_KEY present:", !!process.env.RESEND_API_KEY, "length:", (process.env.RESEND_API_KEY || "").length);
console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
console.log("Sending test email to:", testRecipient);
console.log("---------------------------------------");

try {
  const result = await sendEmail({
    to: testRecipient,
    subject: "Math LLC ERP — isolated deliverability test",
    html: "<p>This is an isolated test of the email service, sent directly, bypassing all app business logic.</p>",
    text: "This is an isolated test of the email service, sent directly, bypassing all app business logic.",
  });
  console.log("SUCCESS. Provider response:");
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log("FAILURE. Provider error:");
  console.log(err.message);
  console.log(err);
}
