import nodemailer from 'nodemailer';

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // safenet2026@gmail.com
        pass: process.env.EMAIL_PASS, // Your 16-char App Password
      },
    }); 

    const mailOptions = {
      from: `"SafeNet Security" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      text: text,
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Email sent successfully to:", to);
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
};

export default sendEmail;