const nodemailer = require("nodemailer");

const getTransporter = () => {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) return null;
  return nodemailer.createTransport({
    service: process.env.MAIL_SERVICE || "gmail",
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });
};

const sendMail = async (to, subject, html) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[DEV EMAIL] To: ${to} | ${subject}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to,
    subject,
    html,
  });
};

const sendOtpEmail = async (email, otp) => {
  await sendMail(
    email,
    "LISHA Academy Password Reset OTP",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#2f7d32;">Password Reset Request</h2>
      <p>Your OTP is:</p>
      <div style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#1f2937;margin:16px 0;">${otp}</div>
      <p>Valid for 10 minutes.</p>
    </div>`
  );
};

const sendWelcomeEmail = async (email, fullName, username, role, tempPassword) => {
  try {
    const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
    await sendMail(
      email,
      "Welcome to LISHA Academy!",
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="background:#2e7d32;color:white;padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:28px;">Welcome to LISHA Academy</h1>
        </div>
        <div style="padding:24px;">
          <p style="font-size:16px;margin-bottom:16px;">Hi <strong>${fullName}</strong>,</p>
          <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:16px;">
            Your account has been successfully created by an administrator. You are now registered as a <strong>${roleDisplay}</strong> on LISHA Academy.
          </p>
          
          <div style="background:#f3f4f6;padding:16px;border-radius:6px;margin:20px 0;">
            <p style="margin:0 0 12px 0;font-size:12px;color:#666;text-transform:uppercase;font-weight:bold;">Account Details</p>
            <p style="margin:8px 0;font-size:14px;"><strong>Username:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;">${username}</code></p>
            <p style="margin:8px 0;font-size:14px;"><strong>Email:</strong> ${email}</p>
            <p style="margin:8px 0;font-size:14px;"><strong>Temporary Password:</strong> <code style="background:#e5e7eb;padding:2px 6px;border-radius:3px;">${tempPassword}</code></p>
            <p style="margin:12px 0 0 0;font-size:12px;color:#d32f2f;"><strong>⚠️ Important:</strong> Please change your password after your first login.</p>
          </div>
          
          <p style="font-size:14px;color:#555;line-height:1.6;margin:20px 0;">
            You can now log in to the platform and start your learning journey. Visit the platform to access your courses and content.
          </p>
          
          <div style="text-align:center;margin:24px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" style="display:inline-block;background:#2e7d32;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Log In to Your Account</a>
          </div>
          
          <p style="font-size:12px;color:#666;margin-top:24px;">If you did not request this account, please contact your administrator immediately.</p>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="font-size:12px;color:#6b7280;margin:0;">LISHA Academy - e-learning platform</p>
          <p style="font-size:11px;color:#9ca3af;margin:4px 0 0 0;">For support, contact: support@lishaacademy.com</p>
        </div>
      </div>`
    );
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send welcome email to ${email}:`, error.message);
  }
};

const sendNotificationEmail = async (email, title, message, link = "") => {
  try {
    const linkHtml = link
      ? `<p><a href="${link}" style="color:#2e7d32;font-weight:bold;">View details →</a></p>`
      : "";
    await sendMail(
      email,
      `LISHA Academy — ${title}`,
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#2e7d32;">${title}</h2>
        <p>${message}</p>
        ${linkHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:12px;color:#6b7280;">LISHA Academy e-learning platform</p>
      </div>`
    );
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send notification email to ${email}:`, error.message);
  }
};

const sendReminderEmail = async (email, { date, time, message, courseTitle, link }) => {
  try {
    await sendMail(
      email,
      "LISHA Academy — Learning Reminder",
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#2e7d32;">Time to learn!</h2>
        <p><strong>Date:</strong> ${date} at ${time}</p>
        <p><strong>Course:</strong> ${courseTitle}</p>
        <p>${message}</p>
        <p><a href="${link}" style="color:#2e7d32;font-weight:bold;">Open My Learning →</a></p>
      </div>`
    );
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send reminder email to ${email}:`, error.message);
  }
};

const sendPasswordChangeOtpEmail = async (email, otp) => {
  await sendMail(
    email,
    "LISHA Academy — Password Change OTP",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#2f7d32;">Verify Password Change</h2>
      <p>Your OTP to change your password is:</p>
      <div style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#1f2937;margin:16px 0;">${otp}</div>
      <p>Valid for 10 minutes. If you did not request this, ignore this email.</p>
    </div>`
  );
};

const sendSecurityAlertEmail = async (email, action, details = {}) => {
  try {
    const time = new Date().toLocaleString();
    const ip = details.ip ? `<p><strong>IP:</strong> ${details.ip}</p>` : "";
    await sendMail(
      email,
      `LISHA Academy — Security alert: ${action}`,
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
        <h2 style="color:#2e7d32;">Account activity notice</h2>
        <p><strong>Action:</strong> ${action}</p>
        <p><strong>Time:</strong> ${time}</p>
        ${ip}
        <p>If this wasn't you, please reset your password immediately and contact support.</p>
      </div>`
    );
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send security alert email to ${email}:`, error.message);
  }
};

module.exports = {
  sendOtpEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
  sendReminderEmail,
  sendPasswordChangeOtpEmail,
  sendSecurityAlertEmail,
  sendMail,
};
