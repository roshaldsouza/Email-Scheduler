# 📬 Email Scheduler (ReachInbox Assignment)

This repository contains a **production-grade Email Scheduling System** built with:
- **Express + TypeScript** backend
- **BullMQ + Redis** job queue
- **PostgreSQL (Prisma ORM)** database
- **Next.js + Tailwind CSS** frontend
- **Ethereal Email (fake SMTP)** for testing email delivery

---

## 🚀 Features

### Backend
✔ Accept email scheduling via API  
✔ Store jobs in a relational database (PostgreSQL)  
✔ Use BullMQ with Redis for delayed jobs (no cron jobs)  
✔ Support configurable **delay between emails**  
✔ Support **hourly per-sender rate limiting**  
✔ Persistent jobs survive server restarts  
✔ Idempotent email sending (no duplicates)  
✔ Worker concurrency support

### Frontend
✔ Google OAuth Login  
✔ Dashboard for Scheduled & Sent emails  
✔ Compose modal with:
- Rich email body (bold, italic, underline)
- CSV upload of recipients
- Delay & hourly limit config
- Start time picker
✔ Search UI with pagination support  
✔ Email preview panel

---

## 🧠 Architecture Overview

### 🛠 Core Technologies
- **BullMQ**: Node.js job queue using Redis as store  
- **Redis**: In-memory store used by BullMQ for job persistence/delays  
- **Prisma** + **PostgreSQL**: Structured DB for jobs + recipients  
- **Ethereal Email**: Fake SMTP server for testing emails  
- **Next.js + Tailwind**: UI dashboard

---

## 🧾 Database Schema

### EmailJob
| Field | Description |
|-------|-------------|
| id | Unique job |
| fromEmail | Sender email |
| subject | Email subject |
| body | HTML body |
| scheduledAt | When email batch starts |
| status | job state |
| userId | Owner |

### EmailRecipient
| Field | Description |
|-------|-------------|
| id | Unique recipient row |
| emailJobId | FK to job |
| toEmail | Recipient email |
| status | scheduled / processing / sent / failed |
| scheduledAt | when to send |
| sentAt | timestamp of send |

---

## ⏱ Scheduling Logic

1. **API receives scheduling request**  
2. Create `EmailJob` + one `EmailRecipient` per recipient  
3. Add BullMQ delayed jobs for each recipient with appropriate delay  
4. Worker picks jobs from queue when delay expires  
5. Worker checks **rate limit** and **min delay**
6. Email is sent via Ethereal SMTP  
7. DB status updated

---

## 🧠 Concurrency & Rate Limiting

### Delay Between Emails
We enforce a minimum delay (e.g., 2s) using BullMQ limiter and internal wait.

### Hourly Limit
We enforce per-sender hourly limits using Redis counters:
- If hourly limit is reached, job is rescheduled into next hour window (no failure).
- This ensures order and persistence.

---

## 🛠 Getting Started

### 🧩 Prerequisites
- Node.js (LTS)
- Docker (for DB + Redis)
- PostgreSQL
- Redis

### Clone & Install


git clone https://github.com/roshaldsouza/Email-Scheduler.git
cd Email-Scheduler
Backend Setup
cd backend
npm install
cp .env.example .env
# update .env with credentials
npx prisma migrate dev
npm run dev   # start API
Worker
npm run worker

Frontend Setup
cd frontend
npm install
cp .env.example .env
npm run dev
📬 Ethereal Email Setup
Use Ethereal for SMTP (fake email delivery):

Create an account via nodemailer createTestAccount()

Add credentials to .env

Emails won’t go to real inboxes — preview links are provided

📌 Environment Variables
# backend
DATABASE_URL="postgresql://.."
REDIS_URL="redis://localhost:6379"
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000

# ethereal SMTP
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# frontend
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_API_URL=http://localhost:5000



🙌 Summary

This project builds a reliable, production-grade email scheduler that:

Schedules and sends with delay and rate limit
Survives restarts
Shows rich UI dashboard

Thank you! 🚀

