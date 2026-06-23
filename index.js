require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Environment Variables for Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;

// Professional function to send messages directly to Telegram using HTTP Fetch (No crashing libraries needed)
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MY_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            })
        });
        const data = await response.json();
        if (!data.ok) {
             console.error("Telegram API Error Response:", data);
        }
        return data;
    } catch (error) {
        console.error("Telegram Fetch Error:", error);
    }
}

// The main Summarization Endpoint
app.post('/summarize', async (req, res) => {
    try {
        const { email } = req.body; // Frontend sends 'email'

        if (!email) {
            return res.status(400).json({ error: "Email text is strictly required." });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Professional System Prompt in English (Expecting JSON response)
        const prompt = `You are an executive AI assistant. Read the provided email. Generate a professional summary in exactly 2 sentences. Then, extract any key action items or tasks. You must return your response STRICTLY as a JSON object with exactly two keys: 'summary' and 'action_items'. Here is the email: ${email}`;

        const result = await model.generateContent(prompt);
        let text = result.response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const finalData = JSON.parse(text);

        // Formatting Action items for Telegram
        let actionItemsText = "";
        if (Array.isArray(finalData.action_items)) {
            actionItemsText = finalData.action_items.map(item => `• ${item}`).join('\n');
        } else {
            actionItemsText = finalData.action_items;
        }

        // Send the formatted summary to your Telegram
        const telegramMessage = `*New Professional Email Summary*\n\n*Summary:*\n${finalData.summary}\n\n*Action Items:*\n${actionItemsText}`;
        await sendTelegramMessage(telegramMessage);

        // Send the JSON response back to the frontend website
        res.json(finalData);

    } catch (error) {
        console.error("Server Execution Error:", error);
        res.status(500).json({ error: "An internal server error occurred while processing the request." });
    }
});

// Root Endpoint for Vercel Health Check
app.get('/', (req, res) => {
    res.send('Enterprise Email Automation Engine is actively running.');
});

module.exports = app;