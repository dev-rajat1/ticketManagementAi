import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ CRITICAL: GEMINI_API_KEY is missing in .env file');
}

// Initialize the SDK
const genAI = new GoogleGenerativeAI(apiKey || '');

// Initialize the AI Model (gemini-1.5-flash is fast, reliable, and available on free tier)
const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const aiModel = genAI.getGenerativeModel({ model: modelName });
