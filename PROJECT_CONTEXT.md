# 🎟️ TicketAI (SmartSupport) - Detailed AI Context & Architecture

This document serves as a comprehensive technical context for AI agents, developers, and maintainers working on **TicketAI**. Read this to understand the system architecture, core modules, data flow, and technologies used without having to scan the entire codebase.

---

## 🎯 1. Project Overview & Objective
TicketAI is an intelligent, automated IT Support & Helpdesk platform. 
It streamlines the ticket resolution process by integrating **Google Gemini AI** for ticket summarization, sentiment analysis, and auto-reply generation. It also features a fully functional **Email-to-Ticket integration**, which continuously monitors an inbox and automatically creates tickets from incoming emails.

---

## 💻 2. Technology Stack & Dependencies

### Core Backend
- **Node.js (v18+)** & **Express.js (v4.21+)** - Application server & routing.
- **Nodemon** - Development server auto-reloading.

### Database & ORM
- **PostgreSQL** - Hosted on **Supabase**.
- **Prisma ORM (v6.4+)** - Database schema management, migrations, and typed querying.

### Authentication & Security
- **JSON Web Tokens (jsonwebtoken)** - Short-lived Access Tokens & long-lived Refresh Tokens.
- **Bcrypt (v5.1+)** - Secure password hashing.
- **Helmet** & **Cors** - HTTP headers security and Cross-Origin Resource Sharing.
- **express-rate-limit** - API request rate limiting to prevent brute-force attacks.

### AI Integration
- **@google/generative-ai** - Integration with Google's Gemini models for text analysis and generation.

### Email & File Processing
- **ImapFlow & Mailparser** - Used by the background listener to read IMAP mailboxes and parse MIME email structures into support tickets.
- **Nodemailer** - SMTP client for sending transactional notifications (ticket created, assigned, resolved).
- **Multer** - Handling `multipart/form-data` for ticket file attachments (saved in `./uploads`).

### Documentation & Validation
- **express-validator** - Middleware for payload and query string validation.
- **swagger-jsdoc & swagger-ui-express** - Auto-generated interactive API documentation.

---

## 🏗️ 3. Architecture Overview
The application follows a standard **Controller-Service-Route** (MVC-like) architecture to maintain separation of concerns:

1. **Routes (`src/routes/`)**: Maps HTTP endpoints to specific controller methods. Applies authentication (`auth.js`) and validation (`validate.js`) middleware.
2. **Controllers (`src/controllers/`)**: Handles incoming HTTP requests, extracts parameters/body, calls the appropriate Service, and formats the `apiResponse`.
3. **Services (`src/services/`)**: Contains the core business logic. Interacts with the Prisma database client and external APIs (Gemini, Email).
4. **Middleware (`src/middleware/`)**: Global error handlers, JWT verifiers, and Role guards (`roleGuard.js`).

---

## ⚙️ 4. Core Modules & Workflows

### 🛡️ A. Authentication & Authorization
- **Endpoints:** `/api/auth/register`, `/login`, `/refresh`, `/logout`.
- **Roles:** `ADMIN`, `AGENT`, `USER`.
- **Flow:** 
  - Login issues a 15-min Access Token and a 7-day Refresh Token (stored in DB).
  - The `auth.js` middleware validates the JWT on protected routes.
  - The `roleGuard.js` middleware ensures endpoints like "Delete User" or "View Dashboard" are restricted to ADMIN/AGENT.

### 🎫 B. Ticket Management (`ticket.service.js`)
- **Lifecycle:** `OPEN` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`.
- **History Tracking:** Every update (status change, assignment) logs a record in the `TicketHistory` table for audit trails.
- **Attachments:** Users can upload files via `multer` which are linked to tickets via the `Attachment` model.

### 🤖 C. AI Integration (`ai.service.js`)
- **Sentiment & Summary:** When a ticket is created, Gemini analyzes the description and updates the ticket's `ai_sentiment` and `ai_summary` fields.
- **Smart Replies:** Agents can request AI-generated draft replies based on the ticket context, improving response times.

### 📧 D. Email-to-Ticket System (`mail-listener.service.js` & `email.service.js`)
- **Incoming (IMAP):** A background listener connects to a Gmail account. When a new unread email arrives, it parses the subject, body, and sender. If the sender matches a user, a ticket is created automatically.
- **Outgoing (SMTP):** Sends status updates to users (e.g., "Your ticket #123 has been resolved").

### 📊 E. Dashboard (`dashboard.controller.js`)
- Provides aggregated metrics for admins: Ticket counts by status, average resolution time, and agent performance stats.

---

## 🗄️ 5. Database Schema (Prisma)
- **`User` (`users`)**: Fields for email, hashed password, role, profile details. Has relations to tickets created and tickets assigned.
- **`Ticket` (`tickets`)**: Fields for ticket number, subject, description, status, priority, due date. AI fields (`ai_sentiment`, `ai_summary`).
- **`Comment` (`comments`)**: Links to Ticket and User. Flag `is_ai_generated` to distinguish human vs AI responses.
- **`Attachment` (`attachments`)**: File metadata (URL/path, mimetype, size) linked to a Ticket.
- **`TicketHistory` (`ticket_history`)**: Tracks `field_changed`, `old_value`, `new_value`, and the user who made the change.
- **`RefreshToken` (`refresh_tokens`)**: Stores valid refresh tokens for session management.

---

## 📂 6. Detailed Project Structure
```text
ticketai/backend/
├── prisma/
│   ├── schema.prisma             # DB Schema definition
│   └── seed.js                   # Admin user and dummy data seeder
├── src/
│   ├── app.js                    # Express app setup, middleware, and route mounting
│   ├── config/                   # Configuration for DB (Prisma client), Email, AI
│   ├── controllers/              # HTTP request handlers (auth, user, ticket, ai, dashboard)
│   ├── docs/                     # Swagger API documentation configuration
│   ├── middleware/               # Auth, Error Handling, Role Guards, Validation
│   ├── routes/                   # Express Routers
│   ├── services/                 # Core Business Logic (DB interactions, Mail IMAP listener)
│   └── utils/                    # Constants, JWT utilities, standardized API responses
├── uploads/                      # Local file storage for attachments
├── Dockerfile                    # Containerization instructions
├── docker-compose.yml            # Docker orchestration
└── package.json                  # Scripts and dependencies
```

---

## 🚀 7. Environment & Deployment Guide

### Critical Environment Variables (`.env`)
- **Supabase PostgreSQL Configuration:**
  - `DATABASE_URL`: Must point to the connection pooler (e.g., port `6543`) and include `?pgbouncer=true`.
  - `DIRECT_URL`: Must point to the direct session port (e.g., port `5432`) without `pgbouncer=true`. Used strictly by Prisma for migrations.
- **Secrets:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`.
- **Email config:** `SMTP_USER`, `SMTP_PASS`, `IMAP_USER`, `IMAP_PASS`.

### ☁️ Railway Deployment
Both backend and frontend are decoupled and deployed on Railway:
- **Backend:** Node.js Docker container (using `backend/Dockerfile`). Exposes port 5000, connects to Supabase PostgreSQL, and uses `gemini-2.0-flash`.
- **Frontend:** Nginx Static Server (using `frontend/Dockerfile`). The backend API URL is currently hardcoded in `js/api.js` to ensure stable connectivity without environment variable injection issues.

### 🐳 Docker Execution (Local)
The backend is fully containerized. To build and start the application locally:
```bash
docker compose up --build -d
```
*Note: The container uses a non-root user (`node`), mounts `./backend/uploads` for persistent local file storage, and runs `npx prisma db push` automatically on startup.*
