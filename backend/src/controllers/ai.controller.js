import aiService from '../services/ai.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Auto-categorize a ticket
 */
export const categorize = async (req, res, next) => {
  try {
    const { subject, description } = req.body;
    if (!subject || !description) {
      return errorResponse(res, 'Subject and description are required', 400);
    }
    const result = await aiService.categorize(subject, description);
    return successResponse(res, 'Ticket categorized successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Suggest responses for a ticket
 */
export const suggestResponse = async (req, res, next) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) {
      return errorResponse(res, 'ticketId is required', 400);
    }
    const suggestions = await aiService.suggestResponses(ticketId);
    return successResponse(res, 'Response suggestions generated', suggestions);
  } catch (error) {
    next(error);
  }
};

/**
 * Analyze sentiment
 */
export const analyzeSentiment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return errorResponse(res, 'Text is required', 400);
    }
    const result = await aiService.analyzeSentiment(text);
    return successResponse(res, 'Sentiment analyzed', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Summarize a ticket
 */
export const summarize = async (req, res, next) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) {
      return errorResponse(res, 'ticketId is required', 400);
    }
    const summary = await aiService.summarize(ticketId);
    return successResponse(res, 'Ticket summarized', summary);
  } catch (error) {
    next(error);
  }
};

/**
 * Find similar tickets
 */
export const findSimilar = async (req, res, next) => {
  try {
    const { subject, description } = req.body;
    if (!subject || !description) {
      return errorResponse(res, 'Subject and description are required', 400);
    }
    const result = await aiService.findSimilar(subject, description);
    return successResponse(res, 'Similar tickets found', result);
  } catch (error) {
    next(error);
  }
};

/**
 * AI Chat about a ticket
 */
export const chat = async (req, res, next) => {
  try {
    const { ticketId, message } = req.body;
    if (!ticketId || !message) {
      return errorResponse(res, 'ticketId and message are required', 400);
    }
    const result = await aiService.chat(ticketId, message);
    return successResponse(res, 'AI response generated', result);
  } catch (error) {
    next(error);
  }
};
