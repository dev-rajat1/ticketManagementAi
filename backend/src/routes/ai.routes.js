import { Router } from 'express';
import { body } from 'express-validator';
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleGuard.js';
import validateRequest from '../middleware/validate.js';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/ai/categorize - Auto-categorize a ticket
 */
router.post(
  '/categorize',
  [
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    validateRequest,
  ],
  aiController.categorize
);

/**
 * POST /api/ai/suggest-response - Get AI response suggestions
 */
router.post(
  '/suggest-response',
  authorize('ADMIN', 'AGENT'),
  [
    body('ticketId').trim().notEmpty().withMessage('ticketId is required'),
    validateRequest,
  ],
  aiController.suggestResponse
);

/**
 * POST /api/ai/analyze-sentiment - Analyze text sentiment
 */
router.post(
  '/analyze-sentiment',
  [
    body('text').trim().notEmpty().withMessage('Text is required'),
    validateRequest,
  ],
  aiController.analyzeSentiment
);

/**
 * POST /api/ai/summarize - Summarize a ticket thread
 */
router.post(
  '/summarize',
  authorize('ADMIN', 'AGENT'),
  [
    body('ticketId').trim().notEmpty().withMessage('ticketId is required'),
    validateRequest,
  ],
  aiController.summarize
);

/**
 * POST /api/ai/similar-tickets - Find similar resolved tickets
 */
router.post(
  '/similar-tickets',
  [
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    validateRequest,
  ],
  aiController.findSimilar
);

/**
 * POST /api/ai/chat - Chat with AI about a ticket
 */
router.post(
  '/chat',
  authorize('ADMIN', 'AGENT'),
  [
    body('ticketId').trim().notEmpty().withMessage('ticketId is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    validateRequest,
  ],
  aiController.chat
);

export default router;
