require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Environment Variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MY_CHAT_ID = process.env.MY_CHAT_ID;

// Professional function to send messages directly to Telegram (No crashing libraries needed)
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
        return await response.json();
    } catch (error) {
        console.error("Telegram API Error:", error);
    }
}

// The main Summarization Endpoint
app.post('/summarize', async (req, res) => {
    try {
        const { emailText } = req.body;

        if (!emailText) {
            return res.status(400).json({ error: "Email text is strictly required." });
        }

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        // Professional System Prompt in English
        const prompt = `Please provide a professional, highly concise summary of the following email, followed by a clear bulleted list of Action Items. Keep the tone corporate and strictly in English.\n\nEmail Content:\n${emailText}`;

        const result = await model.generateContent(prompt);
        const summary = result.response.text();

        // Send the formatted summary to your Telegram
        const telegramMessage = `*New Professional Email Summary*\n\n${summary}`;
        await sendTelegramMessage(telegramMessage);

        // Send the response back to the frontend website
        res.json({ summary: summary });

    } catch (error) {
        console.error("Server Execution Error:", error);
        res.status(500).json({ error: "An internal server error occurred while processing the request." });
    }
});

// Root Endpoint for Vercel Health Check
app.get('/', (req, res) => {
    res.send('Enterprise Email Automation Engine is actively running.');
});

// Port Configuration
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server successfully initialized on port ${PORT}`);
});