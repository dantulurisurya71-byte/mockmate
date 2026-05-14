# MockMate — AI-Powered Mock Interview Platform

A full-stack AI mock interview platform with conversational voice interviewers, resume analysis, real-time transcription, and analytics.

---

## 🏗️ Architecture

```
Browser (UI)
  │  HTTPS / WebSocket
  ▼
Frontend (TanStack Start + Vite)  ← port 3000
  │  REST
  ▼
Backend API (Express + Prisma)    ← port 5000
  │  SQL          │  Redis (BullMQ)
  ▼               ▼
PostgreSQL     Queue jobs
                   │
                   ▼
        Worker process (BullMQ)
                   │
                   ▼
      AI Service (FastAPI + Groq) ← port 8000
        ├── Piper TTS  (WAV audio)
        ├── Faster-Whisper (transcription)
        └── Groq LLM  (conversation + evaluation)
```

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | TanStack Start, Vite, React 19, TailwindCSS 4, Zustand, shadcn/ui |
| **Backend** | Node.js, Express 5, TypeScript, Prisma ORM |
| **AI Service** | Python 3.12, FastAPI, Groq (via OpenAI client) |
| **TTS** | Piper TTS (offline, 3 voices: ryan, joe, amy) |
| **Transcription** | Faster-Whisper small model (CPU, int8) |
| **Database** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7, BullMQ |
| **Realtime** | Socket.IO (signaling) |
| **Auth** | JWT, bcrypt, HTTP-only cookies, RBAC |
| **DevOps** | Docker Compose, GitHub Actions, Prometheus, Grafana |

---

## 🛠️ Complete Setup Guide

You can run this project in two ways: **Using Docker (Recommended)** or **Manual Local Setup**.

### Prerequisites
- [Node.js](https://nodejs.org/en/) v20+
- [Python](https://www.python.org/) v3.12+
- [Docker & Docker Compose](https://www.docker.com/) *(Docker method)*
- [PostgreSQL 16](https://www.postgresql.org/) + [Redis 7](https://redis.io/) *(Manual method)*
- A [Groq API Key](https://console.groq.com/keys) — **Get one free at [console.groq.com](https://console.groq.com/keys)**

---

### Method 1: Docker Compose (Recommended)

Spins up all 8 services (Frontend, Backend, Worker, AI Service, Database, Redis, Prometheus, Grafana) with one command.

#### Step 1: Clone the repository
```bash
git clone https://github.com/DSurya11/mockmate.git
cd mockmate
```

#### Step 2: Download voice models (REQUIRED)
The voice model files (`.onnx`) are **not included in the repo** because they're too large for GitHub. You must download them before running the app.

**Run this command in the project root:**
```bash
node download_voices.js
```

This will download 6 voice model files (~360 MB total) into the `voices/` folder.

**Expected output:**
```
✓ Downloaded en_US-ryan-high.onnx
✓ Downloaded en_US-joe-medium.onnx
✓ Downloaded en_US-amy-low.onnx
✓ Downloaded en_US-john-medium.onnx
✓ Downloaded en_US-kathleen-low.onnx
✓ Downloaded en_US-kristin-medium.onnx
```

#### Step 3: Set your Groq API key and start
```bash
# Windows PowerShell
$env:GROQ_API_KEY="your-groq-api-key-here"
docker compose up --build -d

# Mac / Linux
GROQ_API_KEY="your-groq-api-key-here" docker compose up --build -d
```

**Wait 30-60 seconds** for all services to start.

#### Step 4: Access the services
- **Frontend UI:** `http://localhost:3000`
- **Backend API:** `http://localhost:5000`
- **AI Service:** `http://localhost:8000`
- **Grafana:** `http://localhost:3001` (admin / admin)
- **Prometheus:** `http://localhost:9090`

#### Troubleshooting Docker Setup

**Problem: "Cannot find voice model files"**
- Solution: Run `node download_voices.js` in the project root.

**Problem: "GROQ_API_KEY not set"**
- Solution: Make sure you set the environment variable before running `docker compose up`.

**Problem: "Port already in use"**
- Solution: Stop any services using ports 3000, 5000, 8000, 5432, 6379, 9090, or 3001.
  ```bash
  docker compose down
  # Then restart
  docker compose up -d
  ```

---

### Method 2: Manual Local Setup

If you prefer to run services individually without Docker.

#### Step 0: Clone and download voice models
```bash
git clone https://github.com/DSurya11/mockmate.git
cd mockmate
node download_voices.js   # REQUIRED - downloads voice model files
```

#### Step 1: Start Database & Redis
```bash
docker compose up postgres redis -d
```

Wait 10 seconds for them to be ready.

#### Step 2: Backend (Express / Node.js)
```bash
cd backend
npm install
```

Create `backend/.env` file with these values:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_interview?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
GROQ_API_KEY=your-groq-api-key-here
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

Run database migrations and start:
```bash
npx prisma generate
npx prisma db push
npm run dev
```

Backend should now be running on `http://localhost:5000`.

#### Step 3: AI Service (Python / FastAPI)

Open a **new terminal window**, then:

```bash
cd ai-service
python -m venv venv

# Activate virtual environment:
# Windows PowerShell:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create `ai-service/.env` file:
```env
AI_SERVICE_PORT=8000
GROQ_API_KEY=your-groq-api-key-here
BACKEND_URL=http://localhost:5000
```

Start the AI service:
```bash
python -m app.main
```

AI service should now be running on `http://localhost:8000`.

#### Step 4: Frontend (TanStack Start / Vite)

Open a **new terminal window**, then:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` file:
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

#### Manual Setup Troubleshooting

**Problem: "Cannot connect to database"**
- Make sure `docker compose up postgres redis -d` is running.
- Check `DATABASE_URL` in `backend/.env` matches the connection string.

**Problem: "Voice model not found"**
- Run `node download_voices.js` from the project root.

**Problem: "Module not found" errors**
- Make sure you ran `npm install` in both `backend/` and `frontend/`.
- For AI service, make sure you activated the virtual environment before `pip install`.

---

## ✨ Features

- **Conversational AI Interviewers** — 3 distinct personas (Alex, Marcus, Sarah), each with a unique voice, tone, and specialty area, powered by Groq LLMs
- **6-Phase Interview Flow** — Greeting → Small Talk → Agenda → Background → Core Questions → Closing, enforced by a master prompt
- **Piper TTS Voice Synthesis** — Offline WAV audio for each interviewer response; falls back to browser `speechSynthesis`
- **Hybrid Transcription** — Browser `SpeechRecognition` provides live word display during recording; Faster-Whisper delivers the final accurate transcript after stop
- **4-Second Review Window** — After Whisper processes the answer, a countdown gives the candidate time to review before auto-submit
- **Adaptive Follow-up Questions** — Backend injects AI-generated follow-ups based on answers (up to 4, capped at 12 total questions)
- **Resume Analysis** — PDF upload, ATS scoring, skill extraction via Groq, processed via BullMQ workers
- **6 Interview Types** — Technical, Behavioral, System Design, HR, DSA, Mixed
- **Analytics Dashboard** — Score trends, category breakdowns, recent interview history
- **JWT Auth** — HTTP-only cookie tokens, refresh token rotation, RBAC (Candidate / Recruiter / Admin)
- **Prometheus + Grafana** — HTTP request metrics, WebSocket connection gauge, worker job metrics

---

## 📊 Core API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (CANDIDATE or RECRUITER) |
| POST | `/api/auth/login` | Login, sets HTTP-only cookies |
| POST | `/api/auth/refresh` | Rotate refresh token |
| GET | `/api/auth/me` | Current authenticated user |
| POST | `/api/resumes` | Upload PDF resume |
| GET | `/api/resumes` | List resumes |
| POST | `/api/resumes/:id/analyze` | Trigger AI analysis |
| POST | `/api/interviews` | Create interview + generate questions |
| GET | `/api/interviews/:id` | Get interview with questions |
| PATCH | `/api/interviews/:id/start` | Start interview (→ IN_PROGRESS) |
| PATCH | `/api/interviews/:id/complete` | Complete + compute scores |
| POST | `/api/interviews/conversational` | AI conversational turn (proxied to AI service) |
| POST | `/api/interviews/questions/:id/answer` | Submit answer transcript |
| POST | `/api/tts` | Synthesize speech (Piper TTS → WAV) |
| POST | `/api/transcribe/` | Transcribe audio (Faster-Whisper) |
| GET | `/api/analytics/candidate` | Candidate score analytics |
| GET | `/api/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

---

## 📁 Project Structure

```
├── frontend/          TanStack Start + Vite + React 19 (port 3000)
├── backend/           Express 5 + TypeScript + Prisma (port 5000)
├── ai-service/        FastAPI + Groq + Piper TTS + Faster-Whisper (port 8000)
├── monitoring/        Prometheus + Grafana configs
├── voices/            Piper TTS .onnx voice model files (downloaded via script)
├── .github/           CI/CD workflows
├── download_voices.js Script to download voice models
└── docker-compose.yml Full 8-service orchestration
```

---

## 🚫 Important: Large Files & Git

The following files are **NOT committed to Git** because they're too large for GitHub:

- `voices/*.onnx` — Voice model binaries (~60-115 MB each)
- `*.wav`, `*.webm` — Test audio files
- `testdata/*.pdf` — Sample resume PDFs

**These files are automatically ignored** via `.gitignore`.

### For New Contributors

If you clone this repo and want to contribute:

1. **Download voice models first:**
   ```bash
   node download_voices.js
   ```

2. **Never commit large binary files.** If you add new test audio or models, add them to `.gitignore`.

3. **If you accidentally stage a large file:**
   ```bash
   git rm --cached path/to/large-file
   git commit --amend --no-edit
   ```

4. **Push safely** — Git will reject pushes with files >100 MB. If that happens, remove them from history before pushing.
