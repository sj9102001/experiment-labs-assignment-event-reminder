const express = require("express");
const cron = require("node-cron");
require("dotenv").config();
const { collection, getDocs, query, where, doc, updateDoc } = require("firebase/firestore");
const db = require("./firebase-config");
// Email service (for sending reminders)
const nodemailer = require("nodemailer");

// Initialize Express App
const app = express();
app.use(express.json());

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER, // email
        pass: process.env.EMAIL_PASS, // email app-specific password
    },
});

// Function to send reminder emails
const sendEmail = async (to, subject, text) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        text,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

const fun = async () => {
    console.log("Running cron job...");

    try {
        // Step 1: Get all users
        const usersSnapshot = await getDocs(collection(db, "users"));
        if (usersSnapshot.empty) {
            console.log("No users found.");
            return;
        }

        // Step 2: Loop through each user
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userEmail = userData.email;

            // Step 3: Check the events subcollection
            const eventsCollection = collection(db, `users/${userDoc.id}/events`);

            const currentTime = new Date();
            const thirtyMinutesFromNow = new Date(currentTime.getTime() + 30 * 60 * 1000);

            const eventsQuery = query(
                eventsCollection,
                // where("eventTime", ">=", currentTimeFirestore),
                // where("eventTime", "<=", thirtyMinutesFromNowFirestore),
                where("isReminderSent", "==", false)
            );

            const eventsSnapshot = await getDocs(eventsQuery);
            if (!eventsSnapshot.empty) {
                for (const eventDoc of eventsSnapshot.docs) {
                    const eventData = eventDoc.data();
                    const eventTime = eventData.date.toDate();
                    if (eventTime >= currentTime &&
                        eventTime <= thirtyMinutesFromNow &&
                        !eventData.isReminderSent) {
                        // Step 4: Send email reminder
                        await sendEmail(
                            userEmail,
                            `Reminder for Event: ${eventData.title}`,
                            `Your event "${eventData.title}" is scheduled to start at ${eventTime.getMonth() + 1}/${eventTime.getDate()}/${eventTime.getFullYear()} ${eventTime.getHours()}:${eventTime.getMinutes().toString().padStart(2, '0')}.`
                        );

                        // Step 5: Update isSentReminder to true
                        const eventRef = doc(db, `users/${userDoc.id}/events`, eventDoc.id);
                        await updateDoc(eventRef, { isReminderSent: true });

                    }

                }
            } else {
            }
        }
    } catch (error) {
        console.error("Error processing cron job:", error);
    }
};


cron.schedule("*/10 * * * *", fun);

app.get("/", (req, res) => {
    res.send("Email reminder service is running...");
});

// Start Express server
const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});