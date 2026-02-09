import nodemailer from 'nodemailer';

const sendEmail = async (to, subject, text) => {
  console.log(`\n🔄 Starting email send process to: ${to}`);
  try {
    // Validate email environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️ Email credentials not configured in environment variables');
      console.warn('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'NOT SET');
      console.warn('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'NOT SET');
      throw new Error('Email credentials not configured');
    }

    console.log(`📧 Email credentials found. From: ${process.env.EMAIL_USER}`);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // safenet2026@gmail.com
        pass: process.env.EMAIL_PASS, // Your 16-char App Password
      },
      // Disable SSL verification for environments with certificate inspection (firewall, proxy, antivirus)
      tls: {
        rejectUnauthorized: false
      }
    });

    // Test the connection
    console.log('🔐 Verifying email service connection...');
    const verified = await transporter.verify();
    console.log(`✅ Email service verified:`, verified);

    const mailOptions = {
      from: `"SafeNet Security" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: text,
    };

    console.log(`📨 Sending email to ${to} with subject: "${subject}"`);
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully!");
    console.log("   Recipient:", to);
    console.log("   MessageID:", result.messageId);
    console.log("   Response:", result.response);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("\n❌ EMAIL SEND FAILED");
    console.error("Recipient:", to);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Full error details:", error);
    throw error; // Propagate the error so the caller knows it failed
  }
};

export default sendEmail;