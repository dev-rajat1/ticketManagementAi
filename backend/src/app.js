import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';

// Import routes
import authRoutes from './routes/auth.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import userRoutes from './routes/user.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

// Import middleware
import errorHandler from './middleware/errorHandler.js';

// Import Swagger
import { swaggerSpec, swaggerUi } from './docs/swagger.js';

// Import Services
import mailListenerService from './services/mail-listener.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Allowed origins — frontend URL Railway env se aayega
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:80',
  'http://localhost:3000',
  'http://localhost:80',
  'http://localhost:5173',
];

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Set to true in production with proper config
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

app.use(cors({
  origin: true, // Allow all origins for now to prevent Railway blocking
  credentials: true,
}));
app.use(morgan('dev'));

app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Uploads serve karna (attachments ke liye)
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  
  // Start Email to Ticket Listener
  mailListenerService.start();
});

export default app;
