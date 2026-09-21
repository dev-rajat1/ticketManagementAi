import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from '../utils/constants.js';

// Controllers
import {
  create,
  findAll,
  findById,
  update,
  deleteTicket,
  addComment,
  getComments,
  addAttachment,
  deleteAttachment,
  getHistory,
  bulkAction,
  getAiSummary,
  getAiSuggestions,
  createFromAudio,
} from '../controllers/ticket.controller.js';

// Middleware
import authenticate from '../middleware/auth.js';
import authorize from '../middleware/roleGuard.js';
import validateRequest from '../middleware/validate.js';

const router = Router();

// ─── Multer Configuration ───────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a',
    'audio/ogg',
    'audio/webm',
  ];

  if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Accepted: images, PDFs, DOC/DOCX, TXT, Audio'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  },
  fileFilter,
});

// Audio specific upload with up to 25MB limit
const audioUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio recordings are allowed (.mp3, .wav, .m4a, .ogg, .webm)'), false);
    }
  },
});


// ─── All routes require authentication ──────────────────────
router.use(authenticate);

// ─── Validation Rules ───────────────────────────────────────

const findAllValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(Object.values(TICKET_STATUS)).withMessage('Invalid status'),
  query('priority').optional().isIn(Object.values(TICKET_PRIORITY)).withMessage('Invalid priority'),
  query('category').optional().isIn(TICKET_CATEGORIES).withMessage('Invalid category'),
];

const createTicketValidation = [
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(`Priority must be one of: ${Object.values(TICKET_PRIORITY).join(', ')}`),
  body('category')
    .optional()
    .isIn(TICKET_CATEGORIES)
    .withMessage(`Category must be one of: ${TICKET_CATEGORIES.join(', ')}`),
];

const updateTicketValidation = [
  param('id').isString().notEmpty().withMessage('Ticket ID is required'),
  body('status')
    .optional()
    .isIn(Object.values(TICKET_STATUS))
    .withMessage(`Status must be one of: ${Object.values(TICKET_STATUS).join(', ')}`),
  body('priority')
    .optional()
    .isIn(Object.values(TICKET_PRIORITY))
    .withMessage(`Priority must be one of: ${Object.values(TICKET_PRIORITY).join(', ')}`),
  body('category')
    .optional()
    .isIn(TICKET_CATEGORIES)
    .withMessage(`Category must be one of: ${TICKET_CATEGORIES.join(', ')}`),
];

const idParamValidation = [
  param('id').isString().notEmpty().withMessage('Ticket ID is required'),
];

const commentValidation = [
  param('id').isString().notEmpty().withMessage('Ticket ID is required'),
  body('content').trim().notEmpty().withMessage('Comment content is required'),
];

const bulkActionValidation = [
  body('action')
    .isIn(['updateStatus', 'assign', 'delete'])
    .withMessage('Action must be one of: updateStatus, assign, delete'),
  body('ticketIds')
    .isArray({ min: 1 })
    .withMessage('ticketIds must be a non-empty array'),
];

// ─── Routes ─────────────────────────────────────────────────

router.get('/', findAllValidation, validateRequest, findAll);
router.post('/', createTicketValidation, validateRequest, create);
router.post('/from-audio', audioUpload.single('audio'), createFromAudio);
router.post(
  '/bulk-action',
  authorize('ADMIN', 'AGENT'),
  bulkActionValidation,
  validateRequest,
  bulkAction,
);

router.get('/:id', idParamValidation, validateRequest, findById);
router.put('/:id', updateTicketValidation, validateRequest, update);
router.delete('/:id', authorize('ADMIN'), idParamValidation, validateRequest, deleteTicket);
router.get('/:id/history', idParamValidation, validateRequest, getHistory);
router.post('/:id/comments', commentValidation, validateRequest, addComment);
router.get('/:id/comments', idParamValidation, validateRequest, getComments);
router.post(
  '/:id/attachments',
  idParamValidation,
  validateRequest,
  upload.single('file'),
  addAttachment,
);
router.delete('/:id/attachments/:attachmentId', idParamValidation, validateRequest, deleteAttachment);

// AI Specific Routes
router.get('/:id/ai-summary', idParamValidation, validateRequest, getAiSummary);
router.get('/:id/ai-suggest', authorize('ADMIN', 'AGENT'), idParamValidation, validateRequest, getAiSuggestions);

export default router;
