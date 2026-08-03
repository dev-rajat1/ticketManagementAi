import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ CRITICAL: GEMINI_API_KEY is missing in .env file');
}

// Initialize the SDK
const genAI = new GoogleGenerativeAI(apiKey || '');

// Initialize the AI Model
export const aiModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
