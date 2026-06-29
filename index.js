require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;

// ⚠️ YAHAN APNA GOOGLE APPS SCRIPT WALA URL LAZMI DAALNA 
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyb00GBREfRfMLEzEqTsBOJDctiPSaoZlp1-YZhQRzB4G8SMw4ZHcn2jLu7urDQometpA/exec";

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

// 🚨 DIRECT API CALL (Bina kisi npm package ke, taake purani library fail hone ka masla hi khatam ho jaye)
async function getSafeAIResponse(prompt) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return `⚠️ GOOGLE API ERROR: ${data.error?.message || 'Unknown API Error'}`;
        }
        
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        return `⚠️ SERVER ERROR: ${error.message}`;
    }
}

app.post('/summarize', async (req, res) => {
    try {
        const { emailText, sender, subject, uniqueId } = req.body;
        
        // 🔴 LIVE TRACKER: Jaise hi email Vercel ko milegi, sabse pehle yeh message aayega
        await sendTelegramMessage(`🛠 System Check: Email ID #${uniqueId} Vercel tak pohanch gayi hai! AI se summary banwa raha hoon (Wait 5-10 sec)...`);

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