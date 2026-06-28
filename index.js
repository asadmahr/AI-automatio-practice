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

// BHAII YAHAN PAR APNA NAYA WEB APP URL PASTE KAREIN (Agar change hua ho):
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1jGtizMrv3ftZMkkDZfnWyJ1HrxVcJYf5Q9qTIpjBNO6l2kYFtTJLZjArMqsOCd2_pg/exec";

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
        const { emailText, sender, subject, uniqueId } = req.body;
        
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" }); // Model update for stability
        const prompt = `Read this email from ${sender}. Subject: ${subject}.\n\nProvide a 2-sentence summary and a bulleted list of Action Items. Keep tone professional. Plain text only.\n\nEmail Content:\n${emailText}`;

        const result = await model.generateContent(prompt);
        let summaryText = result.response.text();
        
        const telegramMessage = `📧 New Email ID: #${uniqueId}\n👤 From: ${sender}\n📌 Subject: ${subject}\n\nSummary & Action Items:\n${summaryText}\n\nReply with #${uniqueId} [your message] to generate a reply.`;
        
        await sendTelegramMessage(telegramMessage);
        res.status(200).json({ status: "Success", message: "Sent to Telegram" });
    } catch (error) {
        console.error("Summarize Error:", error);
        await sendTelegramMessage(`❌ AI Error (Summary Nahi Bani): ${error.message}`);
        res.status(500).json({ error: "Server Error" });
    }
});

app.post('/webhook', async (req, res) => {
    try {
        if (!req.body.message || !req.body.message.text) {
            return res.status(200).send('OK');
        }

        const userText = req.body.message.text;
        const idMatch = userText.match(/#([A-Z0-9]+)/);

        if (idMatch) {
            const id = idMatch[1];
            const userReplyIntent = userText.replace(idMatch[0], '').trim();
            
            await sendTelegramMessage(`⏳ Wait karein... Draft ban raha hai...`);
            
            let clientContext;
            try {
                const gasContextResponse = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: "getContext", id: id })
                });
                
                const responseText = await gasContextResponse.text(); 
                
                if (responseText.includes("<html") || responseText.includes("<!DOCTYPE")) {
                     throw new Error("Google ne permission block kar di hai ya URL purana hai.");
                }
                
                clientContext = JSON.parse(responseText); 
            } catch (fetchErr) {
                await sendTelegramMessage(`⚠️ URL ERROR: Vercel purane Google URL par jaraha hai!\n\nHAL (Fix):\n1. Google Apps Script se NAYA Web App URL copy karein.\n2. index.js ki Line 15 (APPS_SCRIPT_URL) mein paste karein.\n3. Vercel ko update karein.`);
                return res.status(200).send('OK');
            }

            if (clientContext && !clientContext.error) {
                const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
                const prompt = `The client (${clientContext.sender}) sent this email: "${clientContext.emailText}".\n\nDraft a professional email reply based on this instruction: "${userReplyIntent}".\n\nIMPORTANT: Only return the exact email body. Sign off the email as "Asad Ali". DO NOT use placeholders like [Your Name].`;
                
                const result = await model.generateContent(prompt);
                const draft = result.response.text();
                
                await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: "sendReply",
                        id: id,
                        replyBody: draft
                    })
                });

                await sendTelegramMessage(`✅ Email Successfully Sent to Client!\n\nEmail Body:\n${draft}`);
            } else {
                await sendTelegramMessage(`⚠️ Error: ID #${id} ki memory Google se mita di gayi hai ya nahi mili.`);
            }
        }
        
        return res.status(200).send('OK'); 

    } catch (error) {
        console.error("Webhook Error:", error);
        await sendTelegramMessage(`❌ AI Error: Jawab process nahi ho saka. Details: ${error.message}`);
        return res.status(200).send('OK');
    }
});

app.get('/', (req, res) => res.send('AI Engine Active.'));
module.exports = app;