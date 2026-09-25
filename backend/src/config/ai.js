import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ CRITICAL: GEMINI_API_KEY is missing in .env file');
}

// Initialize the SDK
export const genAI = new GoogleGenerativeAI(apiKey || '');

// Preferred models in priority order (flash-lite models avoid 503 high-demand errors)
export const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
].filter(Boolean);

// Primary model instance
export const primaryModelName = CANDIDATE_MODELS[0] || 'gemini-flash-lite-latest';
export const aiModel = genAI.getGenerativeModel({ model: primaryModelName });

/**
 * Execute generation with automatic fallback across healthy Gemini models
 */
export async function generateContentWithFallback(requestData, config = {}) {
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: config,
      });

      const result = await model.generateContent(requestData);
      const response = await result.response;
      const text = response.text();
      if (text) {
        return { text: text.trim(), modelUsed: modelName };
      }
    } catch (err) {
      console.warn(`⚠️ Model [${modelName}] failed: ${err.message}. Trying next available model...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models failed to generate content');
}

