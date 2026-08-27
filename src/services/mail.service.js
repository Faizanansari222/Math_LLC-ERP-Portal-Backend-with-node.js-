import { sendEmail } from "../config/mail.config.js";

/**
 * Send a generic email to a client
 */
const sendClientEmail = async ({ to, subject, message, clientName }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Math LLC</h1>
      </div>
      <div style="padding: 20px; background-color: #f9fafb;">
        <p>Hello ${clientName || "there"},</p>
        <div style="line-height: 1.6; color: #374151;">
          ${message}
        </div>
      </div>
      <div style="padding: 10px 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>This email was sent from Math LLC ERP System.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: message,
  });
};

/**
 * Send a welcome email to a new client
 */
const sendWelcomeEmail = async ({ to, clientName, services }) => {
  const serviceList = services?.length
    ? `<ul>${services.map((s) => `<li>${s}</li>`).join("")}</ul>`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Welcome to Math LLC!</h1>
      </div>
      <div style="padding: 20px; background-color: #f9fafb;">
        <p>Hello ${clientName},</p>
        <p>Thank you for choosing <strong>Math LLC</strong> for your business needs. We are thrilled to have you as a client.</p>
        <p>We specialize in tax preparation, payroll management, bookkeeping, and business formation services. Our team is committed to providing you with exceptional service.</p>
        ${serviceList ? `<p><strong>Your subscribed services:</strong></p>${serviceList}` : ""}
        <p>If you have any questions, feel free to reach out to us.</p>
        <p>Best regards,<br/><strong>Math LLC Team</strong></p>
      </div>
      <div style="padding: 10px 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>This email was sent from Math LLC ERP System.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: "Welcome to Math LLC",
    html,
    text: `Hello ${clientName},\n\nThank you for choosing Math LLC for your business needs.\n\nBest regards,\nMath LLC Team`,
  });
};

/**
 * Send a tax filing status update email
 */
const sendTaxStatusEmail = async ({
  to,
  clientName,
  taxFilingStatus,
  businessName,
}) => {
  const statusMessages = {
    "not-started": "has not been started yet.",
    "in-progress": "is currently in progress.",
    review: "is under review.",
    filed: "has been successfully filed!",
    amended: "has been amended.",
  };

  const statusMsg =
    statusMessages[taxFilingStatus] || "status has been updated.";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Tax Filing Update</h1>
      </div>
      <div style="padding: 20px; background-color: #f9fafb;">
        <p>Hello ${clientName},</p>
        <p>We wanted to inform you that the tax filing for <strong>${businessName || "your account"}</strong> ${statusMsg}</p>
        <p><strong>Status:</strong> ${taxFilingStatus}</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br/><strong>Math LLC Team</strong></p>
      </div>
      <div style="padding: 10px 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>This email was sent from Math LLC ERP System.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Tax Filing ${taxFilingStatus === "filed" ? "Complete" : "Update"} - ${businessName || "Your Account"}`,
    html,
    text: `Hello ${clientName},\n\nThe tax filing for ${businessName || "your account"} ${statusMsg}\n\nStatus: ${taxFilingStatus}\n\nBest regards,\nMath LLC Team`,
  });
};

/**
 * Send a project update email
 */
const sendProjectUpdateEmail = async ({
  to,
  clientName,
  projectName,
  status,
  message,
}) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #4F46E5; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Project Update</h1>
      </div>
      <div style="padding: 20px; background-color: #f9fafb;">
        <p>Hello ${clientName},</p>
        <p>Here is an update on your project <strong>${projectName}</strong>:</p>
        <p><strong>Status:</strong> ${status}</p>
        ${message ? `<p>${message}</p>` : ""}
        <p>Best regards,<br/><strong>Math LLC Team</strong></p>
      </div>
      <div style="padding: 10px 20px; text-align: center; color: #9ca3af; font-size: 12px;">
        <p>This email was sent from Math LLC ERP System.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Project Update: ${projectName}`,
    html,
    text: `Hello ${clientName},\n\nProject: ${projectName}\nStatus: ${status}\n${message || ""}\n\nBest regards,\nMath LLC Team`,
  });
};

export {
  sendClientEmail,
  sendWelcomeEmail,
  sendTaxStatusEmail,
  sendProjectUpdateEmail,
};
