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

/**
 * Send a client invitation email via Resend
 */
const sendInvitationEmail = async ({ to, clientName, invitationUrl, invitedByName }) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>You're Invited to Math LLC ERP</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="background-color: #4F46E5; padding: 24px 32px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Math LLC ERP</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <h2 style="color: #111827; font-size: 20px; margin: 0 0 16px;">You've Been Invited!</h2>
                  <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                    Hello <strong>${clientName}</strong>,
                  </p>
                  <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                    <strong>${invitedByName}</strong> has invited you to join <strong>Math LLC ERP</strong> — our platform for tax preparation, payroll management, bookkeeping, and business formation services.
                  </p>
                  <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                    Click the button below to accept your invitation and create your account. This link will expire in <strong>24 hours</strong>.
                  </p>
                  <!-- CTA Button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td style="border-radius: 6px; background-color: #4F46E5;">
                        <a href="${invitationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
                    If the button doesn't work, copy and paste this URL into your browser:<br />
                    <a href="${invitationUrl}" style="color: #4F46E5; word-break: break-all;">${invitationUrl}</a>
                  </p>
                </td>
              </tr>
              <!-- Security Notice -->
              <tr>
                <td style="padding: 0 32px 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEF3C7; border-radius: 6px; border: 1px solid #F59E0B;">
                    <tr>
                      <td style="padding: 12px 16px;">
                        <p style="color: #92400E; font-size: 13px; line-height: 1.5; margin: 0;">
                          <strong>⚠️ Security Notice:</strong> If you did not expect this invitation, please ignore this email or contact our support team. Do not share this link with anyone.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This invitation was sent by Math LLC ERP System. © ${new Date().getFullYear()} Math LLC. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = [
    `You've Been Invited to Math LLC ERP`,
    ``,
    `Hello ${clientName},`,
    ``,
    `${invitedByName} has invited you to join Math LLC ERP — our platform for tax preparation, payroll management, bookkeeping, and business formation services.`,
    ``,
    `Accept your invitation by visiting the link below (valid for 24 hours):`,
    `${invitationUrl}`,
    ``,
    `If you did not expect this invitation, please ignore this email or contact our support team.`,
    ``,
    `© ${new Date().getFullYear()} Math LLC. All rights reserved.`,
  ].join("\n");

  return sendEmail({
    to,
    subject: "You're Invited to Math LLC ERP",
    html,
    text,
  });
};

export {
  sendClientEmail,
  sendWelcomeEmail,
  sendTaxStatusEmail,
  sendProjectUpdateEmail,
  sendInvitationEmail,
};
