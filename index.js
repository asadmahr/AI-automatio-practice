require('dotenv').config();
const express = require('express');
const cors = require('cors');
// GHILTI YAHAN THI! Ab yeh naam bilkul theek hai
const { GoogleGenerativeAI } = require('@google/generative-ai'); 

const app = express();
app.use(cors());
app.use(express.json());

// Environment Variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;

// Initialize Gemini (Theek tareeqe se)
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Memory: Emails yaad rakhne ke liye (Telegram Reply ke liye)
const emailContext = new Map();

// Helper: Telegram par message bhejna
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MY_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });
    } catch (error) {
        console.error("Telegram API Error:", error);
    }
}

// 1. GMAIL SENSOR YAHAN MESSAGE BHEJEGA
app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject } = req.body;

        if (!emailText) {
            return res.status(400).json({ error: "Email text missing." });
        }

        // Email ko ek Unique ID dena
        const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
        emailContext.set(uniqueId, { sender, subject, emailText });

        // Gemini se baat karna (1.5-flash fast model use kar rahe hain)
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // AI ko command (Bina JSON ke taake crash na ho)
        const prompt = `Read this email from ${sender || 'Unknown'}. Subject: ${subject || 'No Subject'}.\n\nProvide a 2-sentence summary and a bulleted list of Action Items. Do not use JSON. Just return the clean text.\n\nEmail Content:\n${emailText}`;

        // YEH HAI ASAL JADOO (Fire & Forget Logic bina await ke)
        model.generateContent(prompt).then(async (result) => {
             const summaryText = result.response.text();

             // Telegram ke liye khubsurat message tayyar karna
             const telegramMessage = `📧 *New Email ID: #${uniqueId}*\n👤 *From:* ${sender || 'Unknown'}\n📌 *Subject:* ${subject || 'No Subject'}\n\n*Summary & Action Items:*\n${summaryText}\n\n_Reply with #${uniqueId} [your message] to generate a professional reply._`;
             
             await sendTelegramMessage(telegramMessage);
        }).catch(err => console.error("Gemini Error Background:", err));

        // Vercel aur Gmail ko fauran OK keh kar farigh karna (Taake Crash na ho)
        res.status(200).json({ status: "Success", message: "Processing started in background." });

    } catch (error) {
        console.error("Summarize Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. TELEGRAM YAHAN SE REPLY KAREGA (Webhook)
app.post('/webhook', async (req, res) => {
    try {
        // Hamesha 200 OK bhejna zaroori hai warna Telegram baar baar bhejta hai
        if (!req.body.message || !req.body.message.text) {
            return res.status(200).send('OK');
        }

        const userText = req.body.message.text;
        
        // ID dhoondna (jaise #ABC12)
        const idMatch = userText.match(/#([A-Z0-9]+)/);
        let prompt = "";

        if (idMatch && emailContext.has(idMatch[1])) {
            const context = emailContext.get(idMatch[1]);
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            prompt = `The client (${context.sender}) sent this email: "${context.emailText}".\n\nDraft a professional, medium-length corporate email reply based on this rough instruction: "${userReplyIntent}". Only return the final email body.`;
        } else {
            prompt = `Draft a professional, medium-length corporate email based on this rough note: "${userText}". Only return the final email body.`;
        }

        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Background Process for Webhook
        model.generateContent(prompt).then(async (result) => {
            const draft = result.response.text();
            await sendTelegramMessage(`*Drafted Professional Reply:*\n\n${draft}`);
        }).catch(err => console.error("Gemini Webhook Error Background:", err));
        
        res.status(200).send('OK');

    } catch (error) {
        console.error("Webhook Error:", error.message);
        res.status(200).send('Error handled');
    }
});

// Zinda check karne ke liye
app.get('/', (req, res) => {
    res.send('AI Email Engine is 100% Alive and Running.');
});

// Vercel ke liye Server Export
module.exports = app;