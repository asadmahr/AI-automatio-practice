const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize Telegram Bot securely
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.MY_CHAT_ID;
let bot;

if (token) {
    bot = new TelegramBot(token, {polling: false});
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Main Summarization Endpoint
app.post('/summarize', async (req, res) => {
  try {
    const emailText = req.body.email;

    if (!emailText) {
      return res.status(400).json({ error: "Please provide the email content." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an executive AI assistant. Read the provided email. Generate a professional summary in exactly 2 sentences. Then, extract any key action items or tasks. You must return your response STRICTLY as a JSON object with exactly two keys: 'summary' and 'action_items'. Here is the email: ${emailText}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const finalData = JSON.parse(text);

    // Send real-time alert to Telegram
    if (bot && chatId) {
        let actionItemsText = "";
        if (Array.isArray(finalData.action_items)) {
            actionItemsText = finalData.action_items.map(item => `• ${item}`).join('\n');
        } else {
            actionItemsText = finalData.action_items;
        }

        const tgMessage = `📧 *New Email Processed*\n\n📝 *Executive Summary:*\n${finalData.summary}\n\n✅ *Action Items:*\n${actionItemsText}`;
        await bot.sendMessage(chatId, tgMessage, { parse_mode: 'Markdown' });
    }

    res.json(finalData);
  } catch (error) {
    console.error("AI Processing Error:", error);
    res.status(500).json({ error: "Internal server error while connecting to AI Engine." });
  }
});

module.exports = app;