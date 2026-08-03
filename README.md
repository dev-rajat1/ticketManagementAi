# 🎫 SmartSupport — AI-Powered Ticket Management System

![SmartSupport Dashboard Banner](https://i.imgur.com/example-banner-placeholder.png) <!-- Aap baad mein yahan dashboard ka screenshot laga sakte hain -->

SmartSupport is a modern, full-stack IT Support and Helpdesk ticketing system powered by **Google Gemini AI**. It automates customer support by converting incoming emails into tickets, analyzing sentiment, and automatically generating summaries.

## ✨ Key Features

- 🤖 **AI Integration (Gemini)**: Automatically analyzes ticket descriptions to determine customer sentiment and generates concise summaries for support agents.
- 📧 **Email-to-Ticket Automation**: Listens to a dedicated IMAP email inbox and automatically creates tickets when users send support emails.
- 🔐 **Role-Based Access Control (RBAC)**: Secure authentication with Admin, Agent, and User roles.
- 📊 **Agent Dashboard**: Real-time stats, ticket assignments, and performance monitoring.
- 📱 **Responsive UI**: Clean, modern, glassmorphism-inspired UI built with pure HTML, CSS, and Vanilla JavaScript.
- 📎 **File Attachments**: Upload and manage attachments for tickets securely.
- 🔄 **JWT Authentication**: Access and refresh token implementation for robust security.

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3 (Custom Glassmorphism UI)
- Vanilla JavaScript (ES6+)
- Nginx (for production static serving)

**Backend:**
- Node.js & Express.js
- Prisma ORM
- PostgreSQL (via Supabase)
- Google Generative AI (Gemini SDK)
- Node-IMAP & Nodemailer (for email processing)
- JWT (JSON Web Tokens)
- Multer (File Uploads)

**Deployment:**
- Railway.app (Backend & Frontend services)
- Supabase (Managed PostgreSQL Database)

---

## 🚀 Live Demo
- **Frontend URL:** [https://ticketmanagementai-production.up.railway.app](https://ticketmanagementai-production.up.railway.app)
- **Backend API Docs (Swagger):** [https://remarkable-gentleness-production-525d.up.railway.app/api/docs](https://remarkable-gentleness-production-525d.up.railway.app/api/docs)

*(Note: These are sample URLs. If the project is sleeping on the free tier, it might take a few seconds to wake up).*

---

## 💻 Local Setup & Installation

Follow these steps to run the project locally on your machine.

### Prerequisites
- Node.js (v18 or higher)
- A Supabase account (for PostgreSQL database)
- Google Gemini API Key
- Gmail account with an App Password (for IMAP/SMTP)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ticketManagementAi.git
cd ticketManagementAi
```

### 2. Backend Setup
```bash
cd backend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `backend/` directory and copy the contents from `.env.example`:
```bash
cp .env.example .env
```
Fill in your actual database credentials, Gemini key, and Email configurations in the `.env` file.

### 4. Database Setup (Prisma)
Push the schema to your Supabase PostgreSQL database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Start the Application
You can run the backend and frontend simultaneously:

**Start the Backend:**
```bash
# In the /backend folder
npm run dev
```

**Start the Frontend:**
Open the `frontend/index.html` file in your browser, or use a simple local server like Live Server or Python's HTTP server:
```bash
# In the /frontend folder
npx serve .
```

The application will now be running locally. Frontend defaults to `http://localhost:3000` and backend to `http://localhost:5000`.

---

## 🏗️ Project Architecture

The repository is structured as a monorepo containing both the decoupled frontend and backend:

```
ticketManagementAi/
│
├── backend/                  # Node.js/Express REST API
│   ├── prisma/               # Database schema
│   ├── src/
│   │   ├── controllers/      # Route logic
│   │   ├── middleware/       # Auth and Error handling
│   │   ├── routes/           # Express routes
│   │   ├── services/         # AI, Email, and Business logic
│   │   └── app.js            # Server entry point
│   ├── Dockerfile            # Backend Docker config
│   └── railway.toml          # Railway deployment config
│
├── frontend/                 # Static HTML/CSS/JS client
│   ├── css/                  # Modular stylesheets
│   ├── js/                   # Vanilla JS logic (api.js, auth.js, etc.)
│   ├── index.html            # Main SPA entry point
│   └── Dockerfile            # Nginx Docker config
│
└── .gitignore
```

## 🔒 Security
- **Never commit your `.env` file**. It is included in `.gitignore` by default.
- Passwords are securely hashed using `bcryptjs`.
- Cross-Origin Resource Sharing (CORS) is configured to protect the API.
- Rate limiting is implemented to prevent brute-force attacks.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!
Feel free to check [issues page](https://github.com/your-username/ticketManagementAi/issues).

## 📄 License
This project is for personal portfolio and educational purposes.
