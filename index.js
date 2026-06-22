const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Aapka Telegram Setup (Hardcoded taake koi error na aaye)
const token = '8870852933:AAGF-jBmtZQnTaTAdu8XPXsdRD99QtTo2vg';
const MY_CHAT_ID = '7485486653'; 

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// TELEGRAM KO MESSAGE BHEJNE KA ASLI (BULLET-PROOF) TAREEQA
async function sendTelegramMessage(messageText) {
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        // Fetch ka istamal direct API par, koi extra library nahi chahiye!
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: MY_CHAT_ID,
                text: messageText,
                parse_mode: 'Markdown'
            })
        });
        console.log("Telegram par message chala gaya!");
    } catch (error) {
        console.error("Telegram API Error:", error);
    }
}

app.post('/summarize', async (req, res) => {
  try {
    const emailText = req.body.email;
    if (!emailText) {
      return res.status(400).json({ error: "Bhai email toh likho summary ke liye!" });
    }

    // Gemini Engine
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an AI assistant. Read the provided email. Generate a short summary in exactly 2 sentences. Then, extract any action items. You must return your response STRICTLY as a JSON object with exactly two keys: 'summary' and 'action_items'. Here is the email: ${emailText}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const finalData = JSON.parse(text);

    // TELEGRAM JADOO (Naya fail-proof tareeqa)
    const telegramMessage = `📧 *New Email Summary*\n\n📝 *Summary:*\n${finalData.summary}\n\n✅ *Action Items:*\n${finalData.action_items}`;
    await sendTelegramMessage(telegramMessage);

    res.json(finalData);
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "AI se connect karne mein koi masla ho gaya hai." });
  }
});

app.post('/translate', async (req, res) => {
  try {
    const textToTranslate = req.body.text;

    if (!textToTranslate) {
      return res.status(400).json({ error: "Translate karne ke liye text nahi mila!" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Translate the following text into easy-to-understand Urdu. Return EXACTLY a JSON object with one key 'translatedText'. Here is the text: ${textToTranslate}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Translation Error:", error);
    res.status(500).json({ error: "Translate karne mein koi masla aaya hai." });
  }
});

module.exports = app;