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

// ⚠️ YAHAN APNA GOOGLE APPS SCRIPT WALA URL LAZMI DAALNA (Jo pichli dafa theek kiya tha)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyFdC9yJ9o4WldfStwb6yLVwbypB031Xkdfx3H_FtCe-45R_C7XsYq8IcJjA7-GPoIOtw/exec";

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

// 🚨 YAHAN HUMNE DEBUG MODE ON KIYA HAI TA'KE ASAL ERROR NAZAR AAYE
async function getSafeAIResponse(prompt) {
    try {
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        // Ab fallback message nahi aayega, direct Google ka raw error aayega
        return `⚠️ GOOGLE API ERROR: ${error.message}`;
    }
}

app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject, uniqueId } = req.body;
        
        const prompt = `Read this email from ${sender}. Subject: ${subject}.\n\nProvide a 2-sentence summary and a bulleted list of Action Items. Keep tone professional. Plain text only.\n\nEmail Content:\n${emailText}`;

        let summaryText = await getSafeAIResponse(prompt);
        
        const telegramMessage = `📧 New Email ID: #${uniqueId}\n👤 From: ${sender}\n📌 Subject: ${subject}\n\nSummary:\n${summaryText}\n\nReply with #${uniqueId} [your message] to generate a reply.`;
        
        await sendTelegramMessage(telegramMessage);
        res.status(200).json({ status: "Success", message: "Sent to Telegram" });
    } catch (error) {
        console.error("Summarize Error:", error);
        await sendTelegramMessage(`❌ Server Error Handled: ${error.message}`);
        res.status(200).json({ error: "Server Error Handled" });
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
                     throw new Error("Google Server URL is old or blocked.");
                }
                clientContext = JSON.parse(responseText); 
            } catch (fetchErr) {
                await sendTelegramMessage(`⚠️ Error: Google server se raabta toot gaya. Please check Apps Script URL.`);
                return res.status(200).send('OK');
            }

            if (clientContext && !clientContext.error) {
                const prompt = `The client (${clientContext.sender}) sent this email: "${clientContext.emailText}".\n\nDraft a professional email reply based on this instruction: "${userReplyIntent}".\n\nIMPORTANT: Only return the exact email body. Sign off the email as "Asad Ali". DO NOT use placeholders.`;
                
                let draft = await getSafeAIResponse(prompt);
                
                await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: "sendReply", id: id, replyBody: draft })
                });

                await sendTelegramMessage(`✅ Email Successfully Sent to Client!\n\nEmail Body:\n${draft}`);
            } else {
                await sendTelegramMessage(`⚠️ Error: ID #${id} ki memory Google se nahi mili.`);
            }
        }
        return res.status(200).send('OK'); 

    } catch (error) {
        await sendTelegramMessage(`❌ AI Error: ${error.message}`);
        return res.status(200).send('OK');
    }
});

app.get('/', (req, res) => res.send('AI Engine Active.'));
module.exports = app;