const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios'); // Fetch ki jagah Axios behtar error handling karta hai

const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const TELEGRAM_API_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// In-Memory Store for Email Context (Temporary memory for replies)
const emailContext = new Map();

// Helper: Send to Telegram
async function sendTelegramMessage(text) {
    try {
        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
            chat_id: process.env.MY_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error("DEBUG: Telegram Send Error:", error.message);
    }
}

// 1. Summarize Endpoint (From Gmail)
app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject } = req.body;

        if (!emailText) {
            return res.status(400).json({ error: "Email text missing." });
        }

        // Generate a Unique ID for this email
        const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        // Save Context for later replying
        emailContext.set(uniqueId, { sender: sender || "Unknown", subject: subject || "No Subject", emailText });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Read this email. Sender: ${sender || "Unknown"}, Subject: ${subject || "No Subject"}. Content: ${emailText}. 
        Return STRICTLY a JSON object with two keys: 'summary' (a short 1-line paragraph) and 'action_items' (an array of max 2 bullet points). Keep it fast!`;

        const result = await model.generateContent(prompt);
        let textResult = result.response.text();
        textResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const finalData = JSON.parse(textResult);

        const msg = `📧 *New Email ID: #${uniqueId}*\n👤 *From:* ${sender || "Unknown"}\n📌 *Subject:* ${subject || "No Subject"}\n\n*Summary:*\n${finalData.summary}\n\n*Action Items:*\n${finalData.action_items.map(item => `• ${item}`).join('\n')}\n\n_Reply with #${uniqueId} [Your rough message] to draft a professional reply._`;
        
        await sendTelegramMessage(msg);
        
        // VERCEL RULE: Sab kaam hone ke BAAD response bhejein!
        res.status(200).json({ status: "Success", summary: finalData.summary });

    } catch (e) {
        console.error("DEBUG: Processing Error:", e.message);
        // Error aaye toh bhi Vercel ko bata do taake 500 error handle ho
        res.status(500).json({ error: e.message });
    }
});

// 2. Webhook Endpoint (From Telegram - Professional Reply Feature)
app.post('/webhook', async (req, res) => {
    // Immediate ACK to Telegram
    res.sendStatus(200);

    try {
        if (!req.body.message || !req.body.message.text) return;
        const userText = req.body.message.text;
        
        // Check if user is referencing an Email ID (e.g., #ABC12)
        const idMatch = userText.match(/#([A-Z0-9]+)/);
        let prompt = "";

        if (idMatch && emailContext.has(idMatch[1])) {
            const context = emailContext.get(idMatch[1]);
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            
            prompt = `Context: The client sent an email with subject "${context.subject}" and content "${context.emailText}". 
            User wants to reply: "${userReplyIntent}". 
            Draft a medium-length, professional, polite business email based on this. Just give the email body.`;
        } else {
            prompt = `Draft a medium-length, professional business email for this rough request: "${userText}".`;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const reply = result.response.text();

        await sendTelegramMessage(`*Drafted Professional Reply:*\n\n${reply}\n\n_Copy and paste this into your Gmail to send to the client._`);
    } catch (error) {
        console.error("DEBUG: Webhook Processing Error:", error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;