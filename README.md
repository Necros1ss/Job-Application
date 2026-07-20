<p align="center">
  <a href="https://www.uit.edu.vn/" title="University of Information Technology">
    <img src="https://i.imgur.com/WmMnSRt.png" alt="University of Information Technology (UIT)" width="400">
  </a>
</p>

<h1 align="center"><b>SE104 - Job Application Management</b></h1>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-4-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

---

# **Course Project: Full-cycle Job Application Management**

> This repository contains a full-stack **Job Application Management** developed for coursework at the **University of Information Technology (UIT - VNU-HCM)**.
>
> The system supports the full recruitment flow: candidates can search jobs and apply with CVs, recruiters can manage job posts, screen applications, schedule interviews, send messages and onboarding tasks, while admins can moderate users and job listings. The project is built with **React 18 + Vite**, **Express.js**, **PostgreSQL**, **JWT authentication**, and a Docker-based development/deployment setup.

---

## **Project Information**

| Field | Description |
|:--|:--|
| Project | Job Application Management |
| Main stack | React 18, Vite, TailwindCSS, Express.js, PostgreSQL |
| Authentication | JWT access token + refresh token with httpOnly cookie |
| Roles | Candidate, Recruiter, Admin |
| Main goal | Manage recruitment from job posting to onboarding |
| Deployment | Docker Compose with PostgreSQL, backend API, and nginx frontend |

---

## **Table of Contents**

- [Features](#features)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Database Overview](#database-overview)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Docker Deployment](#docker-deployment)
- [API Overview](#api-overview)
- [Security Highlights](#security-highlights)
- [Demo Flow](#demo-flow)
- [Roadmap](#roadmap)
- [License](#license)

---

## **Features**

### **Candidate Features**

- **Authentication flow**: sign up, login, forgot password, reset password, logout.
- **Job search** with keyword search, filters, sorting, pagination, and URL-based query state.
- **Apply to jobs** with CV upload and cover letter.
- **Application tracking** with application status, timeline-style activity, and saved jobs.
- **Profile management** with avatar upload, skills tag input, profile completion checklist, and draft autosave.
- **Messaging** with recruiter conversations and unread counts.
- **Onboarding and employee portal** for accepted candidates, attendance, and leave requests.

### **Recruiter Features**

- **Recruiter dashboard** with analytics charts, application funnel, weekly application trends, and top jobs.
- **Job post management**: create, edit, list, and delete job posts.
- **Application pipeline**: review applications, update status, rate candidates, add notes, reject, offer, and download CVs.
- **AI CV screening** using Gemini integration without mock fallback.
- **Interview scheduling** with candidate notifications.
- **Company profile** with logo upload, LinkedIn validation, company description preview, and completion checklist.
- **Onboarding and employee management** for converting accepted candidates to employees.

### **Admin Features**

- **Admin dashboard** for high-level system statistics.
- **User management**: lock, unlock, soft-delete, and list users.
- **Job moderation**: hide, unhide, and delete job posts.

### **Technical Features**

- **Centralized API client** with automatic access-token refresh.
- **In-memory access token storage** with refresh token in httpOnly cookie.
- **Server-Sent Events (SSE)** for real-time notifications.
- **Filesystem CV storage** instead of storing binary files in PostgreSQL.
- **Zod validation** for backend request validation.
- **Dark mode**, bilingual EN/VI i18n, skeleton loaders, empty states, and global error boundary.
- **Docker Compose full stack** with PostgreSQL, Express API, and nginx-served frontend.

---

## **System Architecture**

```mermaid
flowchart LR
    Candidate["Candidate UI"] --> Frontend["React + Vite Frontend"]
    Recruiter["Recruiter UI"] --> Frontend
    Admin["Admin UI"] --> Frontend

    Frontend --> API["Express.js API"]
    API --> Auth["JWT Auth + Refresh Cookie"]
    API --> Services["Services Layer"]
    Services --> Repositories["Repositories Layer"]
    Repositories --> DB["PostgreSQL"]

    API --> Uploads["Filesystem Uploads"]
    API --> SSE["SSE Notification Stream"]
    API --> Mailer["Nodemailer"]
    API --> AI["AI Screening Service"]
```

### **Backend Layering**

```text
backend/src/
|-- controllers/      # Request handlers
|-- services/         # Business rules and orchestration
|-- repositories/     # SQL queries
|-- routes/           # Express routing and middleware wiring
|-- middlewares/      # Auth, role guard, validation
|-- validators/       # Zod schemas
|-- utils/            # API response, mailer, notifications, sanitize helpers
`-- config/           # PostgreSQL pool and schema bootstrap
```

---

## **Repository Structure**

```text
HR-Management/
|-- backend/
|   |-- src/
|   |   |-- controllers/
|   |   |-- middlewares/
|   |   |-- repositories/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- validators/
|   |   `-- server.js
|   |-- sql/
|   |   |-- schema.sql
|   |   `-- migrations and feature SQL files
|   |-- uploads/
|   |   |-- cv/
|   |   `-- profile/
|   |-- Dockerfile
|   `-- .env.example
|
|-- frontend/
|   |-- src/
|   |   |-- Components/
|   |   |-- Pages/
|   |   |   |-- Admin/
|   |   |   |-- Auth/
|   |   |   |-- Candidates/
|   |   |   |-- Jobs/
|   |   |   `-- Recruiters/
|   |   |-- hooks/
|   |   |-- lib/
|   |   |-- utils/
|   |   `-- main.jsx
|   |-- Dockerfile
|   |-- nginx.conf
|   `-- .env.example
|
|-- docker-compose.yml
|-- package.json
|-- package-lock.json
`-- README.md
```

---

## **Database Overview**

The PostgreSQL schema covers recruitment, onboarding, messaging, and HR workflows.

```text
users
|-- candidates
|-- recruiters
`-- admins through role-based access

recruiters
`-- job_posts
    `-- applications
        |-- application_files
        |-- application_events
        |-- application_notes
        |-- interviews
        |-- messages
        `-- onboarding_tasks

candidates
|-- saved_jobs
|-- employees
|   |-- attendance_records
|   `-- leave_requests
`-- password_reset_tokens
```

Important tables include:

- `users`, `candidates`, `recruiters`
- `job_posts`, `applications`, `application_files`
- `application_events`, `application_notes`
- `interviews`, `messages`
- `onboarding_tasks`, `employees`
- `attendance_records`, `leave_requests`
- `password_reset_tokens`, `saved_jobs`

---

## **Installation**

### **1. Clone repository**

```bash
git clone <your-repository-url>
cd HR-Management
```

### **2. Install dependencies**

The project is managed from the repository root.

```bash
npm install
```

### **3. Prepare environment files**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### **4. Start PostgreSQL with Docker**

```bash
npm run db:up
```

### **5. Run the app in development**

```bash
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:5000/api/health`

---

## **Environment Variables**

### **Backend**

Create `backend/.env` from `backend/.env.example`.

```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5433/job_Management
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-specific-password
MAIL_FROM=Job Management <noreply@jobManagement.com>
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-3.5-flash
UPLOAD_DIR=./uploads/cv
MAX_FILE_SIZE_MB=20
```

### **Frontend**

Create `frontend/.env` from `frontend/.env.example`.

```env
VITE_API_URL=http://localhost:5000/api
```

---

## **Usage**

### **Development commands**

```bash
npm run dev          # Run backend and frontend together
npm run dev:backend  # Run Express API only
npm run dev:frontend # Run Vite frontend only
npm run build:frontend
```

### **Database commands**

```bash
npm run db:up
npm run db:down
npm run db:reset
npm run db:logs
```

---

## **Docker Deployment**

The full stack can run with Docker Compose:

```bash
docker compose up --build
```

Services:

| Service | Port | Description |
|:--|:--:|:--|
| `db` | `5433:5432` | PostgreSQL 16 |
| `backend` | `5000:5000` | Express.js API |
| `frontend` | `5173:80` | nginx serving Vite build |

The frontend nginx container proxies API calls from `/api` to `backend:5000`.

---

## **Vercel Deployment**

The frontend can be easily deployed to Vercel for free global CDN hosting.

1. **Vercel Routing Config**: The `vercel.json` file handles Single Page Application routing (rewrites everything to `index.html`).
2. **Deploy via Vercel Dashboard**:
   - Import the repository.
   - Set **Framework Preset** to `Vite`.
   - Set **Root Directory** to `frontend`.
   - Add Environment Variable: `VITE_API_URL` pointing to your deployed backend (e.g., Render/Railway).
   - Click Deploy.

---

## **API Overview**

Main route groups:

| Route | Purpose |
|:--|:--|
| `/api/auth` | Signup, login, logout, refresh token, password reset |
| `/api/users` | Current user profile, avatar/logo upload, notification preferences |
| `/api/job-posts` | Job listing, advanced search, recruiter job CRUD |
| `/api/applications` | Candidate applications and recruiter application pipeline |
| `/api/interviews` | Interview scheduling and listing |
| `/api/messages` | Candidate-recruiter messaging |
| `/api/onboarding` | Onboarding tasks |
| `/api/employees` | Employee conversion, attendance, leave requests |
| `/api/admin` | Admin dashboard, user management, job moderation |
| `/api/notifications` | SSE notification stream |

---

## **Security Highlights**

- Passwords are hashed with `bcryptjs`.
- Access tokens are short-lived and stored in memory on the frontend.
- Refresh tokens are stored in httpOnly cookies.
- Protected routes use `requireAuth` and role-based guards.
- Request payloads are validated with `zod`.
- SQL queries use parameterized `pg` queries.
- `helmet`, CORS configuration, and rate limiting are enabled on the backend.
- CVs and profile images are stored on the filesystem, not as binary blobs in PostgreSQL.

---

## **Demo Flow**

### **Candidate Flow**

1. Sign up or log in as candidate.
2. Search jobs using filters.
3. Save a job or apply with CV upload.
4. Track application status.
5. Check messages, onboarding tasks, and employee portal after acceptance.

### **Recruiter Flow**

1. Log in as recruiter.
2. Create a job post.
3. Review applications in the recruiter application page.
4. Download CV, add notes, rate candidate, and run AI screening.
5. Schedule interview, reject candidate, or send offer.
6. Convert accepted candidate to employee and manage HR records.

### **Admin Flow**

1. Log in as admin.
2. Review dashboard stats.
3. Lock or unlock users.
4. Hide, unhide, or delete job posts.

---

## **Roadmap**

- Add complete unit and integration test coverage.
- Add Swagger/OpenAPI documentation.
- Add Kanban board for recruiter application pipeline.
- Add production object storage support for uploaded CVs and profile images.
- Add seed data and a guided 15-minute demo script.

---

## **License**

This project is developed for academic use at **University of Information Technology (UIT - VNU-HCM)**.

If a license file is added later, update this section to match the selected license.
