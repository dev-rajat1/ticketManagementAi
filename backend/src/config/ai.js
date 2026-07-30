import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ CRITICAL: GEMINI_API_KEY is missing in .env file');
}

// Initialize the SDK
const genAI = new GoogleGenerativeAI(apiKey || '');

// gemini-2.0-flash — Google ka stable aur fast model (actually exists!)
// gemini-3.5-flash / gemini-3.6-flash dono fake names hain, exist nahi karte
export const aiModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
