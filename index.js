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

// Extremely fast Telegram fetch without waiting for full response processing
async function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        // Adding an AbortController to prevent hanging connections
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout for Telegram

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: MY_CHAT_ID,
                text: text,
                parse_mode: 'Markdown'
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error("Telegram API Error or Timeout:", error.message);
    }
}

app.post('/summarize', async (req, res) => {
    // Vercel Serverless optimization: Immediately tell Gmail "Message Received" so it doesn't timeout
    // We will process the AI and Telegram part asynchronously
    res.status(200).json({ status: "Processing started" });

    try {
        const { emailText } = req.body;

        if (!emailText) {
            console.error("No email text provided");
            return;
        }

        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `Please provide a professional, highly concise summary of the following email, followed by a clear bulleted list of Action Items. Keep the tone corporate and strictly in English.\n\nEmail Content:\n${emailText}`;

        // Gemini AI processing
        const result = await model.generateContent(prompt);
        const summary = result.response.text();

        // Send to Telegram
        const telegramMessage = `*New Professional Email Summary*\n\n${summary}`;
        await sendTelegramMessage(telegramMessage);

    } catch (error) {
        console.error("Server Execution Error during async processing:", error.message);
    }
});

// Root Endpoint for Vercel Health Check
app.get('/', (req, res) => {
    res.send('Enterprise Email Automation Engine is actively running.');
});

// Serve frontend if public folder exists (for testing purposes)
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server successfully initialized on port ${PORT}`);
});