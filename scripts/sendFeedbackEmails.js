import { createClient } from "redis";
import nodemailer from "nodemailer";
import "dotenv/config";

// Redis client setup
const redis = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
});

await redis.connect();

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Email content in both languages
const emailContent = {
  subject: "Feedback Request | प्रतिक्रिया अनुरोध",
  html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <!-- English Version -->
            <div style="margin-bottom: 30px;">
                <h2>Dear User,</h2>
                <p>We hope you are enjoying our BioData web services. Your feedback is valuable to us and helps us improve our platform.</p>
                <p>We would greatly appreciate if you could take a moment to share your experience with us by replying to this email.</p>
                <p>Some points you might want to address:</p>
                <ul>
                    <li>Overall experience with the website</li>
                    <li>Ease of use and navigation</li>
                    <li>Features you found most useful</li>
                    <li>Areas where we can improve</li>
                </ul>
                <p>Thank you for your time and support.</p>
                <p>Best regards,<br>Mokshit Jain<br>Jain Parichay Biodata Group</p>
            </div>

            <hr style="border-top: 2px solid #eee;">

            <!-- Hindi Version -->
            <div style="margin-top: 30px;">
                <h2>प्रिय उपयोगकर्ता,</h2>
                <p>हमें आशा है कि आप हमारी बाइडेटा वेबसाइट सेवाओं का आनंद ले रहे हैं। आपकी प्रतिक्रिया हमारे लिए बहुत महत्वपूर्ण है और हमारे प्लेटफॉर्म को बेहतर बनाने में मदद करती है।</p>
                <p>हम आपसे अनुरोध करते हैं कि कृपया इस ईमेल का जवाब देकर अपने अनुभव को हमारे साथ साझा करें।</p>
                <p>कुछ बिंदु जिन पर आप ध्यान दे सकते हैं:</p>
                <ul>
                    <li>वेबसाइट के साथ समग्र अनुभव</li>
                    <li>उपयोग और नेविगेशन में आसानी</li>
                    <li>सबसे उपयोगी सुविधाएं</li>
                    <li>वे क्षेत्र जहां हम सुधार कर सकते हैं</li>
                </ul>
                <p>आपके समय और समर्थन के लिए धन्यवाद।</p>
                <p>सादर,<br>मोक्षित जैन<br>जैन मालवा बाइडेटा ग्रुप</p>
            </div>
        </div>
    `,
};

async function getAllSessionEmails() {
  try {
    const sessionKeys = await redis.keys("sess:*");
    const emailsWithKeys = [];
    const uniqueEmails = new Set();

    // Extract emails from each session and store with session key
    for (const key of sessionKeys) {
      const sessionData = await redis.get(key);
      try {
        const session = JSON.parse(sessionData);
        if (session.user && session.user.email && !session.feedbackEmailSent) {
          // Only add if email hasn't been seen before
          if (!uniqueEmails.has(session.user.email)) {
            uniqueEmails.add(session.user.email);
            emailsWithKeys.push({ email: session.user.email, key, session });
          } else {
            console.log(`Skipping duplicate email: ${session.user.email}`);
          }
        }
      } catch (error) {
        console.error(`Error parsing session data for key ${key}:`, error);
      }
    }

    return emailsWithKeys;
  } catch (error) {
    console.error("Error fetching session emails:", error);
    return [];
  }
}

async function sendFeedbackEmails() {
  try {
    const emailsData = await getAllSessionEmails();
    console.log(
      `Found ${emailsData.length} users who haven't received feedback email`
    );

    for (const { email, key, session } of emailsData) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        // Update session to mark feedback email as sent
        session.feedbackEmailSent = true;
        await redis.set(key, JSON.stringify(session));

        console.log(`Successfully sent feedback request to ${email}`);
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in sendFeedbackEmails:", error);
  } finally {
    // Close connections
    redis.quit();
  }
}

// Run the script
sendFeedbackEmails();
