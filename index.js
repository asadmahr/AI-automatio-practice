require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log("=== Vercel Engine Starting ===");
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("TELEGRAM_BOT_TOKEN exists:", !!process.env.TELEGRAM_BOT_TOKEN);
console.log("MY_CHAT_ID exists:", !!process.env.MY_CHAT_ID);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Memory for contextual replies
const emailContext = new Map();

async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        console.log("🚀 Telegram ko message bhej raha hoon...");
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MY_CHAT_ID,
                text: text
                // Parse_mode hata diya taake Markdown ka koi error na aaye
            })
        });
        
        const data = await response.json();
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
        res.status(200).json({ status: "Success", message: "Summary sent to Telegram." });

    } catch (error) {
        console.error("❌ Summarize Endpoint Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/webhook', async (req, res) => {
    try {
        if (!req.body.message || !req.body.message.text) {
            return res.status(200).send('OK');
        }

        const userText = req.body.message.text;
        const idMatch = userText.match(/#([A-Z0-9]+)/);
        let prompt = "";

        // Check if the user is replying to a specific email ID
        if (idMatch && emailContext.has(idMatch[1])) {
            const context = emailContext.get(idMatch[1]);
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            prompt = `The client (${context.sender}) sent this email: "${context.emailText}".\n\nDraft a professional corporate email reply based on this rough instruction: "${userReplyIntent}". Only return the final email body in plain text.`;
        } else {
            prompt = `Draft a professional corporate email based on this rough note: "${userText}". Only return the final email body in plain text.`;
        }

        console.log("🧠 Generating professional reply draft...");
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const draft = result.response.text();
        
        // Vercel ab pehle message bhejega, phir 'OK' karega taake crash na ho
        await sendTelegramMessage(`Drafted Professional Reply:\n\n${draft}`);
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