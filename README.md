# PFADS+

PFADS+ is a locally runnable hackathon-ready mental health and academic dropout risk platform for students, counselors, and administrators.

## Stack

- Frontend: HTML, CSS, JavaScript, Chart.js
- Backend: Node.js, Express, MongoDB, Socket.io
- AI services: Python microservice using only the standard library

## Project structure

```text
frontend/
  css/
  js/
  *.html
backend/
  config/
  controllers/
  data/
  middleware/
  models/
  routes/
  services/
  utils/
ai/
  chatbot/
  clustering/
  prediction/
  sentiment/
```

## Local setup

1. Copy `.env.example` to `.env`
2. Start MongoDB locally
3. Install Node dependencies:

```bash
npm install
```

4. Run the backend and AI service:

```bash
npm run dev
```

5. Open `http://localhost:3000`

If port `3000` is already occupied, the backend automatically retries the next available port and prints the actual URL in the terminal.

## Demo credentials

- Email: value of `ADMIN_EMAIL`
- Password: value of `ADMIN_PASSWORD`

Seeded counselors are created automatically when the counselors collection is empty.

- `counselor1@pfadsplus.local`
- `counselor2@pfadsplus.local`
- `counselor3@pfadsplus.local`
- Password: value of `DEMO_COUNSELOR_PASSWORD`

## Key modules

- PFADS 50-question assessment with risk-adjusted scoring and section breakdown
- Local AI clustering for dominant psychological profile detection
- Dropout probability scoring based on PFADS, sentiment, and engagement factors
- Sentiment analysis on AI chat and counselor chat
- Real-time alerts for severe distress, high PFADS scores, and repeated negative patterns
- Counselor workload balancing using specialization, district, and active session count
- Voice-enabled AI support using browser SpeechRecognition and SpeechSynthesis
- Admin analytics with radar, bar, pie, and heatmap views

## Main API endpoints

### Auth

- `POST /api/auth/students/register`
- `POST /api/auth/students/login`
- `POST /api/auth/counselors/register`
- `POST /api/auth/counselors/login`
- `POST /api/auth/admin/login`
- `GET /api/auth/me`

### Student

- `GET /api/students/questions`
- `POST /api/students/assessment`
- `GET /api/students/dashboard`
- `GET /api/students/resources`
- `GET /api/students/emotion-timeline`
- `POST /api/students/appointments`
- `POST /api/students/ai-chat`
- `POST /api/students/resilience`

### Counselor

- `GET /api/counselors/dashboard`
- `GET /api/counselors/appointments`
- `PATCH /api/counselors/appointments/:id`
- `GET /api/counselors/students/:studentId/report`

### Admin

- `GET /api/admin/dashboard`
- `GET /api/admin/students`
- `GET /api/admin/counselors`
- `GET /api/admin/alerts`
- `PATCH /api/admin/alerts/:id/resolve`

### Chat

- `GET /api/chat/rooms/:roomId/messages`
- `POST /api/chat/rooms/:roomId/messages`

## Verification completed

- Backend CommonJS syntax checked with `node --check`
- Python AI service syntax checked with `python -m py_compile`

## Remaining live verification

- `npm install` has not been run in this session
- MongoDB-backed API execution and browser rendering were not live-tested here
