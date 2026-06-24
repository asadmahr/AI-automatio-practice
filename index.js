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

	1. Inbox check kar raha hoon...
3:33:35 PM	Info	✅ 1 Nayi emails mili hain! Process shuru ho raha hai...
3:33:35 PM	Info	📧 Email aayi hai is se: Asad Ali <mahrasadali7865@gmail.com>
3:33:35 PM	Info	🚀 Vercel ko bhej raha hoon...
3:33:36 PM	Info	📡 Vercel ka Jawab: A server error has occurred

FUNCTION_INVOCATION_FAILED

iad1::88n2v-1782297215519-7f4288921fe4
3:33:36 PM	Info	✅ Auto-reply bhej diya!
3:33:36 PM	Info	✅ Email ko Read mark kar diya.
3:33:33 PM	Notice	Execution completed