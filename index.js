require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const emailContext = new Map();

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_CHAT_ID, text: text })
        });
        const data = await response.json();
        console.log("📨 Telegram API Response:", JSON.stringify(data));
        return data;
    } catch (error) {
        console.error("❌ Telegram Fetch Error:", error);
    }
}

app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject } = req.body;
        console.log(`📧 Nayi email aayi hai: ${sender || 'Unknown'}`);

        if (!emailText) {
            return res.status(400).json({ error: "Email text missing." });
        }

        const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
        emailContext.set(uniqueId, { sender, subject, emailText });

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Read this email from ${sender || 'Unknown'}. Subject: ${subject || 'No Subject'}.\n\nProvide a 2-sentence summary and a bulleted list of Action Items. Keep the tone professional. Plain text only, no bold or asterisks.\n\nEmail Content:\n${emailText}`;

        const result = await model.generateContent(prompt);
        let summaryText = result.response.text();
        
        const telegramMessage = `📧 New Email ID: #${uniqueId}\n👤 From: ${sender || 'Unknown'}\n📌 Subject: ${subject || 'No Subject'}\n\nSummary & Action Items:\n${summaryText}\n\nReply with #${uniqueId} [your message] to generate a reply.`;
        
        await sendTelegramMessage(telegramMessage);
        console.log("✅ Sab kuch mukammal! Ab Gmail ko OK bhej raha hoon.");
        res.status(200).json({ status: "Success", message: "Summary sent to Telegram." });

    } catch (error) {
        console.error("❌ Summarize Endpoint Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/webhook', async (req, res) => {
    try {
        console.log("🔔 Telegram se naya reply aya hai!");
        
        if (!req.body.message || !req.body.message.text) {
            console.log("⚠️ Khali message aya hai.");
            return res.status(200).send('OK');
        }

        const userText = req.body.message.text;
        console.log("📝 User ne likha:", userText);

        const idMatch = userText.match(/#([A-Z0-9]+)/);
        let prompt = "";

        if (idMatch && emailContext.has(idMatch[1])) {
            const context = emailContext.get(idMatch[1]);
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            prompt = `The client (${context.sender}) sent this email: "${context.emailText}".\n\nDraft a professional corporate email reply based on this rough instruction: "${userReplyIntent}". Only return the final email body in plain text.`;
        } else {
            prompt = `Draft a professional corporate email based on this rough note: "${userText}". Only return the final email body in plain text.`;
        }

        console.log("🧠 Gemini se draft banwa raha hoon...");
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const draft = result.response.text();
        
        console.log("✅ Draft tayyar! Telegram ko bhej raha hoon...");
        await sendTelegramMessage(`Drafted Professional Reply:\n\n${draft}`);
        
        // Aakhir mein OK bhejenge taake Vercel pehle kaam poora kare!
        res.status(200).send('OK');

    } catch (error) {
        console.error("❌ Webhook Error:", error);
        res.status(200).send('OK');
    }
});

app.get('/', (req, res) => {
    res.send('AI Email Engine Fully Synchronous Mode Active.');
});

module.exports = app;