const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001; 

// Website ki files yahan se uthao
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// PEHLA KAAM: Summary banana
app.post('/summarize', async (req, res) => {
  try {
    const emailText = req.body.email;

    if (!emailText) {
      return res.status(400).json({ error: "Bhai email toh likho summary ke liye!" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an AI assistant. Read the provided email. Generate a short summary in exactly 2 sentences. Then, extract any action items. You must return your response STRICTLY as a JSON object with exactly two keys: 'summary' and 'action_items'. Here is the email: ${emailText}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    res.json(JSON.parse(text));
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "AI se connect karne mein koi masla ho gaya hai." });
  }
});

// NAYA JADOO: Urdu mein Translate karne ka raasta
app.post('/translate', async (req, res) => {
  try {
    const textToTranslate = req.body.text;

    if (!textToTranslate) {
      return res.status(400).json({ error: "Translate karne ke liye text nahi mila!" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // AI ko bata rahe hain ke isko asaan Urdu mein badlo
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

// AAKHRI TABDEELI VERCEL KE LIYE (app.listen mita kar ye lagaya hai)
module.exports = app;