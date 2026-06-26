require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === PRE-FLIGHT CHECK ===
console.log("=== Checking Environment Variables ===");
console.log("GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("TELEGRAM_BOT_TOKEN exists:", !!process.env.TELEGRAM_BOT_TOKEN);
console.log("MY_CHAT_ID exists:", !!process.env.MY_CHAT_ID);
console.log("======================================");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const emailContext = new Map();

// DIAGNOSTIC TELEGRAM SENDER
async function sendTelegramMessage(text) {
    if (!TELEGRAM_BOT_TOKEN || !MY_CHAT_ID) {
        console.error("❌ CRITICAL: Missing Telegram Token or Chat ID!");
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        console.log("🚀 Bhejne laga hoon Telegram ko message...");
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MY_CHAT_ID,
                text: text,
                parse_mode: 'Markdown' // Agar markdown mein error ho toh Telegram reject karta hai
            })
        });
        
        const data = await response.json();
        
        // 🔴 X-RAY: Telegram ka asal jawab logs mein chhaapo!
        console.log("📨 Telegram API Response:", JSON.stringify(data));
        
        if(!data.ok) {
            console.error("❌ Telegram ne Reject kiya:", data.description);
        } else {
            console.log("✅ Message Telegram par successfully deliver ho gaya!");
        }
    } catch (error) {
        console.error("❌ Fetch Error in sendTelegramMessage:", error);
    }
}

app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject } = req.body;

        if (!emailText) {
            return res.status(400).json({ error: "Email text missing." });
        }

        // Fauran Gmail ko OK bhej do taake timeout na ho
        res.status(200).json({ status: "Success", message: "Processing started in background." });

        const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
        emailContext.set(uniqueId, { sender, subject, emailText });

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Read this email from ${sender || 'Unknown'}. Subject: ${subject || 'No Subject'}.\n\nProvide a 2-sentence summary and a bulleted list of Action Items. Keep the tone professional. Do not use JSON. Ensure formatting uses plain text without unclosed asterisks or bold tags.\n\nEmail Content:\n${emailText}`;

        // Background Processing
        model.generateContent(prompt).then(async (result) => {
            let summaryText = result.response.text();
            
            // Telegram Markdown Error se bachne ke liye safe text
            const telegramMessage = `📧 *New Email ID: #${uniqueId}*\n👤 *From:* ${sender || 'Unknown'}\n📌 *Subject:* ${subject || 'No Subject'}\n\n*Summary & Action Items:*\n${summaryText}\n\n_Reply with #${uniqueId} [your message] to generate a reply._`;
            
            await sendTelegramMessage(telegramMessage);
        }).catch(err => console.error("❌ Gemini Error:", err));

    } catch (error) {
        console.error("❌ Summarize Endpoint Error:", error.message);
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

        if (idMatch && emailContext.has(idMatch[1])) {
            const context = emailContext.get(idMatch[1]);
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            prompt = `The client (${context.sender}) sent this email: "${context.emailText}".\n\nDraft a professional corporate email reply based on this rough instruction: "${userReplyIntent}". Only return the final email body.`;
        } else {
            prompt = `Draft a professional corporate email based on this rough note: "${userText}". Only return the final email body.`;
        }

        res.status(200).send('OK');

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        model.generateContent(prompt).then(async (result) => {
            const draft = result.response.text();
            await sendTelegramMessage(`*Drafted Professional Reply:*\n\n${draft}`);
        }).catch(err => console.error("❌ Gemini Webhook Error:", err));

    } catch (error) {
        console.error("❌ Webhook Error:", error.message);
    }
});

app.get('/', (req, res) => {
    res.send('AI Email Engine Diagnostic Mode Active.');
});

module.exports = app;