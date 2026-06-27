require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// YAHAN MAINE AAPKA EXACT URL LAGA DIYA HAI BINA KISI GHALTI KE
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1jGtizMrv3ftZMkkDZfnWyJ1HrxVcJYf5Q9qTIpjBNO6l2kYFtTJLZjArMqsOCd2_pg/exec";

// Memory storage for emails
const emailContext = new Map();

async function sendTelegramMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_CHAT_ID, text: text })
        });
    } catch (err) {
        console.error("Telegram Send Error:", err);
    }
}

app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject } = req.body;
        const uniqueId = Math.random().toString(36).substring(2, 7).toUpperCase();
        
        // Saving email details in memory context
        emailContext.set(uniqueId, { sender, subject, emailText });

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `Read this email from ${sender}. Subject: ${subject}.\n\nProvide a 2-sentence summary and a bulleted list of Action Items. Keep tone professional. Plain text only.\n\nEmail Content:\n${emailText}`;

        const result = await model.generateContent(prompt);
        let summaryText = result.response.text();
        
        const telegramMessage = `📧 New Email ID: #${uniqueId}\n👤 From: ${sender}\n📌 Subject: ${subject}\n\nSummary & Action Items:\n${summaryText}\n\nReply with #${uniqueId} [your message] to generate a reply.`;
        
        await sendTelegramMessage(telegramMessage);
        res.status(200).json({ status: "Success", message: "Sent to Telegram" });
    } catch (error) {
        console.error("Summarize Error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});

app.post('/webhook', async (req, res) => {
    // 1. FAURAN Telegram ko OK bhejo taake wo crash na kare (Super Important)
    res.status(200).send('OK'); 

    try {
        if (!req.body.message || !req.body.message.text) return;

        const userText = req.body.message.text;
        const idMatch = userText.match(/#([A-Z0-9]+)/);

        if (idMatch && emailContext.has(idMatch[1])) {
            const clientContext = emailContext.get(idMatch[1]);
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            
            const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            // PROMPT UPDATE: Fix for [Your Name] to Asad Ali. Yeh hamesha Asad Ali likhega.
            const prompt = `The client (${clientContext.sender}) sent this email: "${clientContext.emailText}".\n\nDraft a professional email reply based on this instruction: "${userReplyIntent}".\n\nIMPORTANT: Only return the exact email body. Sign off the email as "Asad Ali". DO NOT use placeholders like [Your Name].`;
            
            const result = await model.generateContent(prompt);
            const draft = result.response.text();
            
            // Apps script ko data bhejo taake wo Client ko asal email bhej sake
            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientEmail: clientContext.sender,
                    subject: clientContext.subject,
                    replyBody: draft
                })
            });

            // Kamyaabi ka message Telegram par wapas bhejo
            await sendTelegramMessage(`✅ Email Successfully Sent to Client!\n\nEmail Body:\n${draft}`);
        }
    } catch (error) {
        console.error("Webhook Error:", error);
    }
});

app.get('/', (req, res) => res.send('AI Engine Active.'));
module.exports = app;