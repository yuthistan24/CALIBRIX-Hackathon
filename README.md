# PFADS+

PFADS+ is a locally runnable hackathon-ready mental health and academic dropout risk platform for students, counselors, and administrators.

The student-facing shell now also ships as an installable mobile-first web app branded as `MindGuard`, while preserving the existing PFADS+ assessment, AI, counseling, and analytics content.

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

5. If you want the upgraded chatbot to use a local LLM, start Ollama and pull the configured model:

```bash
ollama pull qwen2.5:0.5b-instruct
ollama serve
```

6. Open `http://localhost:3000`

If port `3000` is already occupied, the backend automatically retries the next available port and prints the actual URL in the terminal.

## Mobile app usage

- Open the site from a mobile browser and use `Add to Home Screen` to install `MindGuard` as a full-screen app.
- The frontend now includes:
  - `manifest.webmanifest`
  - `service-worker.js`
  - mobile-safe viewport and safe-area spacing
  - a mobile-first dark visual system shared across dashboards, chat, auth, and analytics pages
- The home screen launcher opens the same app content from `index.html`, so the mobile experience stays connected to the existing website flows and APIs.

### Voice Features
- **Voice Chat**: Uses browser `SpeechRecognition` API for live transcription (works offline)
- **Self-Introduction**: 3-minute recording with automatic transcription
  - Records audio locally (never uploaded)
  - Converts speech to text in real-time
  - AI analyzes needs and urgency
  - Visible to assigned counselor
  - Can be cleared anytime
- **Voice Output**: Text-to-speech for AI responses
- **No server transcription needed**: All voice processing happens in the browser

### Device Integration
- Manual device sync on dashboard for:
  - Steps, sleep hours, focus time
  - Screen time, active/idle minutes
  - Study screen time
- Data sources: Google Fit, Apple Health, Fitbit, or manual entry
- Future: Automatic sync with device sensors

### Games & Videos
- **3 Mini-Games**: Word Search, Number Puzzle, Memory Cards
- **6 Video Categories**: Linked to PFADS assessment sections
  - Emotional Distress, Academic Stress, Social/Peer Support
  - Family Stress, Coping Skills, General Wellness
- All accessible from student dashboard

## Demo credentials

- Default admin email: `admin@pfadsplus.local`
- Default admin password: `Admin@12345`

Seeded counselors are created automatically when the counselors collection is empty.

- `counselor1@pfadsplus.local`
- `counselor2@pfadsplus.local`
- `counselor3@pfadsplus.local`
- Password: value of `DEMO_COUNSELOR_PASSWORD`

## Key modules

- PFADS 50-question assessment with risk-adjusted scoring and section breakdown
- Questionnaire library with full PFADS, separate A/B/C/D/E section assessments, and an Others wellbeing screening
- Local AI clustering for dominant psychological profile detection
- Dropout probability scoring based on PFADS, sentiment, and engagement factors
- Daily mental-health check-ins with stored responses, short-term risk scoring, and alerting
- Daily and counselor-assigned task system with streak tracking and completion-time variance analysis
- Sentiment analysis on AI chat and counselor chat
- Real-time alerts for severe distress, high PFADS scores, repeated negative patterns, screen-time and sleep imbalance, and holistic risk spikes
- Counselor workload balancing using specialization, district, and active session count
- LLM-backed AI support with OpenAI `gpt-4o` / `gpt-4o-mini`, OpenAI-compatible providers, and Ollama local fallback
- LLM-backed self-introduction analysis using the same real provider chain as AI chat
- Voice transcription route for recorded chat messages when OpenAI or a compatible transcription provider is configured, with browser speech recognition fallback
- Voice-enabled AI support using browser SpeechRecognition, SpeechSynthesis, manual start-stop recording, AI chat clearing, and a 3-minute self-introduction recorder with needs analysis
- Multilingual support hooks for major Indian languages through the translation service
- Psychologist directory, scholarship guidance, personalized video recommendations, mini-games, and device sync hooks
- Automatic in-app student activity tracking for screen time, active minutes, idle minutes, and study screen time
- End-to-end student evaluation combining PFADS, prediction, check-ins, sentiment, task adherence, and device metrics
- Mobile-first MindGuard landing page with animated hero scene and installable PWA shell
- Admin analytics with radar, bar, pie, and heatmap views

## New prototype datasets

- `backend/data/psychologists.js`: sample top-10 psychologist directory cards with photos, addresses, and blog links
- `backend/data/scholarships.js`: scholarship opportunities and application guidance
- `backend/data/videoRecommendations.js`: personalized learning and resilience video mapping
- `backend/data/miniGames.js`: mini-game metadata for the student dashboard
- `backend/data/dailyTasks.js`: configurable daily task catalog

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
- `GET /api/students/ai-runtime`
- `GET /api/students/daily-checkin/questions`
- `GET /api/students/daily-checkin`
- `POST /api/students/daily-checkin`
- `POST /api/students/assessment`
- `GET /api/students/dashboard`
- `GET /api/students/resources`
- `GET /api/students/emotion-timeline`
- `POST /api/students/appointments`
- `POST /api/students/ai-chat`
- `DELETE /api/students/ai-chat/history`
- `POST /api/students/voice/transcribe`
- `POST /api/students/daily-tasks/:taskId/complete`
- `POST /api/students/assigned-tasks/:taskId/complete`
- `POST /api/students/device-sync`
- `POST /api/students/self-introduction/analyze`
- `POST /api/students/resilience`

### Counselor

- `GET /api/counselors/dashboard`
- `GET /api/counselors/appointments`
- `PATCH /api/counselors/appointments/:id`
- `GET /api/counselors/students/:studentId/report`
- `POST /api/counselors/students/:studentId/tasks`

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
- Frontend ES module parsing checked with `vm.SourceTextModule`

## Remaining live verification

- `npm install` has not been run in this session
- MongoDB-backed API execution and browser rendering were not live-tested here
- Home-screen installation was not device-tested in this session

## Notes

- The psychologist directory is prototype sample data intended for the hackathon build and should be replaced with institution-approved or verified entries before deployment.
- Device integration currently exposes local sync hooks for manual, wearable, and mobile-health connectors; production deployments should wire those hooks to approved vendor APIs.
- For a real hosted LLM path, set `LLM_PROVIDER=openai` and configure `OPENAI_API_KEY`. For an OpenAI-compatible free or self-hosted provider, set `LLM_PROVIDER=compatible` with `COMPATIBLE_BASE_URL`, `COMPATIBLE_API_KEY`, and `COMPATIBLE_MODEL`. For a free local path, keep `LLM_PROVIDER=ollama` and run Ollama locally.
- The app now grounds LLM prompts with a public psychological guidance corpus in `backend/data/psychologicalKnowledgeBase.js`. Training a new model on private mental-health records should only be done with explicit legal approval, de-identification, and clinical governance.
