require('dotenv').config();
const express = require('express');
const app = express();
const { GoogleGenerativeAI } = require("@google/generative-ai");

app.use(express.json());

// Initialize AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing");

app.post('/summarize', async (req, res) => {
    try {
        const { emailText } = req.body;
        console.log("DEBUG: Processing started.");

        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing in Vercel!");
        if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is missing!");

        // 1. AI Processing
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Summarize this: ${emailText}`);
        const summary = result.response.text();

        // 2. Telegram Send
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: process.env.MY_CHAT_ID, text: summary, parse_mode: 'Markdown' })
        });

        res.status(200).json({ summary: summary });
    } catch (e) {
        console.error("DEBUG ERROR FOUND:", e.message);
        res.status(500).json({ error: "Failed: " + e.message });
    }
});

module.exports = app;