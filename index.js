require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// 1. Frontend website ko connect karna
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 2. Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing");

// 3. Telegram Par Message Bhejne Ka Function
async function sendTelegramMessage(text) {
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const MY_CHAT_ID = process.env.MY_CHAT_ID;
    
    if (!TELEGRAM_BOT_TOKEN || !MY_CHAT_ID) {
        console.log("Telegram Token ya Chat ID missing hai. Message nahi bheja gaya.");
        return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_CHAT_ID, text: text, parse_mode: 'Markdown' })
        });
    } catch (error) {
        console.error("Telegram Bhejne Mein Masla:", error);
    }
}

// 4. Summarize Endpoint (Jo Gmail se bhi hit hoga aur Website se bhi)
app.post('/summarize', async (req, res) => {
    try {
        const emailText = req.body.emailText || req.body.email;
        if (!emailText) {
            return res.status(400).json({ error: "Email ka text missing hai bhai!" });
        }

        console.log("DEBUG: Processing started for Summary.");

        // IMPORTANT FIX: Vercel ko fauran 'OK' bhej dein taake timeout na ho (10s limit bypass)
        // Note: Hum status bhej rahe hain, par aage processing background me chalegi (serverless me thora risky hota hai, par basic testing k liye theek hai)
        res.status(200).json({ status: "Processing in background. Check Telegram shortly." });

        // Iske baad ka process ab background me chalega (Vercel free tier me iski guarantee 100% nahi hoti, par hum try kar rahe hain)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are an AI assistant. Read the provided email. Generate a short summary in exactly 2 sentences. Then, extract any action items. You must return your response STRICTLY as a JSON object with exactly two keys: 'summary' and 'action_items'. Here is the email: ${emailText}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const finalData = JSON.parse(text);

        let telegramMessage = `*New Email Summary* 📧\n\n*Summary:*\n${finalData.summary}\n`;
        if (finalData.action_items && finalData.action_items.length > 0) {
            telegramMessage += `\n*Action Items:*\n- ${finalData.action_items.join('\n- ')}`;
        }
        await sendTelegramMessage(telegramMessage);

    } catch (e) {
        console.error("DEBUG ERROR FOUND in /summarize:", e.message);
        // Error handling if response not already sent
        if (!res.headersSent) {
             res.status(500).json({ error: "Summary banane mein masla: " + e.message });
        }
    }
});

// 5. Translate Endpoint (Website ke "Urdu Mein Translate Karein" button ke liye)
app.post('/translate', async (req, res) => {
    try {
        const textToTranslate = req.body.text;

        if (!textToTranslate) {
            return res.status(400).json({ error: "Translate karne ke liye text nahi mila!" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Translate the following text into easy-to-understand Urdu. Return EXACTLY a JSON object with one key 'translatedText'. Here is the text: ${textToTranslate}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const finalData = JSON.parse(text);
        res.status(200).json(finalData);
    } catch (error) {
        console.error("DEBUG ERROR FOUND in /translate:", error.message);
        res.status(500).json({ error: "Urdu translation fail ho gayi." });
    }
});

// 6. Vercel ke liye export
module.exports = app;
// 6. Telegram Webhook Endpoint (For Receiving Messages from Telegram)
app.post('/webhook', async (req, res) => {
    try {
        console.log("DEBUG: Webhook Request Received from Telegram.");

        // Check if the request has a message object
        if (req.body && req.body.message) {
            const chatId = req.body.message.chat.id;
            const userMessage = req.body.message.text;

            // Only process messages from your specific Chat ID
            const MY_CHAT_ID = parseInt(process.env.MY_CHAT_ID);
            if (chatId !== MY_CHAT_ID) {
                console.log(`DEBUG: Message received from unauthorized chat ID: ${chatId}`);
                return res.status(200).send('OK');
            }

            if (!userMessage) {
                return res.status(200).send('OK');
            }

            console.log(`DEBUG: Processing user message for professional email drafting: "${userMessage}"`);

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `You are a professional corporate assistant. I will give you a rough message (it could be in English or Roman Urdu/Urdu). Your task is to turn this message into a well-crafted, medium-length professional email reply. The tone should be polite and business-appropriate. Do not include subject lines, just the email body. Here is the rough message: "${userMessage}"`;

            const result = await model.generateContent(prompt);
            const professionalReply = result.response.text();

            console.log("DEBUG: Professional reply generated successfully.");

            // Send the professional reply back to Telegram
            const telegramMessage = `*Drafted Professional Reply:*\n\n${professionalReply}`;
            await sendTelegramMessage(telegramMessage);

        }
        
        // Telegram requires a 200 OK response, otherwise it keeps retrying
        res.status(200).send('OK');

    } catch (error) {
        console.error("DEBUG ERROR FOUND in /webhook:", error.message);
        res.status(500).send('Internal Server Error');
    }
});

// 7. Vercel ke liye export
module.exports = app;