const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

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
        const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        // Save Context
        emailContext.set(uniqueId, { sender, subject, emailText });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Read this email. Sender: ${sender}, Subject: ${subject}. Content: ${emailText}. 
        Return JSON: summary (short paragraph) and action_items (list).`;

        const result = await model.generateContent(prompt);
        const finalData = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, ''));

        const msg = `📧 *New Email ID: #${uniqueId}*\n👤 *From:* ${sender}\n📌 *Subject:* ${subject}\n\n*Summary:*\n${finalData.summary}\n\n*Action Items:*\n${finalData.action_items}\n\n_Reply with #${uniqueId} [Your Message] to draft a reply._`;
        
        await sendTelegramMessage(msg);
        res.status(200).json({ status: "Success", id: uniqueId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Webhook Endpoint (From Telegram)
app.post('/webhook', async (req, res) => {
    // Immediate ACK
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
            prompt = `Draft a medium-length, professional business email for this request: "${userText}".`;
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const reply = result.response.text();

        await sendTelegramMessage(`*Drafted Reply:*\n\n${reply}\n\n_Copy and paste this into your Gmail reply._`);
    } catch (error) {
        console.error("DEBUG: Webhook Processing Error:", error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;