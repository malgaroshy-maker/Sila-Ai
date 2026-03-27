# AI Recruitment Intelligence — Project Plan

> Detailed implementation plan for all phases. Each task links to the relevant PRD section.

---

## Phase 1: Foundation ✅

- [x] Set up NestJS backend with module architecture (`app.module.ts`)
- [x] Set up Supabase PostgreSQL (jobs, candidates, applications, analysis_results, settings tables)
- [x] Set up Next.js frontend with `next-intl` for i18n routing
- [x] Implement Job CRUD — `POST/GET /jobs` endpoints + frontend form modal
- [x] Implement CV upload — `POST /candidates/upload` with `pdf-parse` and Gemini extraction
- [x] Implement AI analysis engine — multi-score system (Skills, GPA, Language, Readiness, Final 0–100)
- [x] Generate Strengths, Weaknesses, Hiring Recommendation per candidate per job
- [x] Build Dashboard UI — dark theme, ranked candidates list, color-coded scoring
- [x] Build Settings page — API key configuration stored in Supabase

---

## Phase 2: Email Integration + i18n ✅

- [x] Gmail OAuth2 integration — scan inbox for PDF attachments with label filtering
- [x] Email processor service — auto-extract candidate info and analyze against all jobs
- [x] OCR support — use Gemini multimodal for scanned/image-based PDFs
- [x] Arabic/English i18n — `next-intl` with `ar.json`/`en.json`, RTL layout support
- [x] Arabic Google Font (Tajawal) + English font (Inter) with CSS logical properties
- [x] Simplified CV upload — just file picker, AI auto-extracts name, email, and analyzes

---

## Phase 3: AI Intelligence Layer ✅

- [x] AI Chat System — `ChatService` loads all data as context, `POST /chat` endpoint
- [x] Chat Drawer UI — slide-in panel with message bubbles, typing indicators, quick prompts
- [x] AI Job Creation — `POST /jobs/generate` takes natural language → structured job
- [x] Dual-mode job modal — Form tab + AI Generate tab in frontend
- [x] Smart Features — updated Gemini prompt for `tags`, `flags`, `interview_questions`, `training_suggestions`
- [x] DB migration — added JSONB columns to `analysis_results` table
- [x] Frontend — display tags (indigo pills), flags (amber badges), interview Qs, training suggestions
- [x] Full Arabic translation — all new features translated in `ar.json` with proper RTL

---

## Phase 4: Multi-User & Core PRD Completion ✅

### 4.1 Per-User Data Isolation (§7) ✅
- [x] Add `user_email` column to `jobs`, `candidates`, `settings` tables
- [x] Update all Supabase queries to filter by authenticated user
- [x] Enforce user scoping in all backend services (JobsService, CandidatesService, ChatService)
- [x] Store authenticated user context from Google OAuth session

### 4.2 Settings: Show Connected Email ✅
- [x] Display current Google-authenticated email in the Settings modal
- [x] Show connection status badge (connected / disconnected)
- [x] Add "Disconnect" button to revoke Gmail access

### 4.3 AI Behavior Modes (§3.4) ✅
- [x] Add `ai_mode` setting (Balanced / Strict) to settings table
- [x] Update AI analysis prompt to adjust scoring strictness based on mode
- [x] Add toggle switch in Settings modal UI
- [x] Balanced = current behavior; Strict = harsher on missing skills, lower scores

### 4.4 PDF Report Export (§3.8) ✅
- [x] Install `puppeteer` in backend
- [x] Create `ReportsModule` with `GET /reports/job/:id/pdf` endpoint
- [x] Build HTML template: ranked candidates table, score breakdown charts, AI justifications
- [x] Add "📄 Export PDF" button per job on dashboard
- [x] Support Arabic reports (RTL PDF layout)

---

## Phase 5: Advanced Pipeline ✅

### 5.1 Candidate Kanban Board
- [x] Add `pipeline_stage` column to `applications` table (Applied / Screening / Interview / Offered / Hired / Rejected)
- [x] Build drag-and-drop Kanban UI component (using `@dnd-kit/core` or similar)
- [x] API endpoint — `PATCH /applications/:id/stage` to update pipeline stage
- [x] Color-coded columns with candidate cards showing score and tags
- [x] Filter by job, search by name
- [x] Track stage change timestamps for analytics

### 5.2 Email Webhook for Exceptional Candidates
- [x] Create `WebhookModule` with `WebhookService`
- [x] After analysis, if `final_score ≥ 90`, trigger notification
- [x] Send email via SendGrid / Nodemailer to recruiter with candidate summary
- [x] Configurable threshold in Settings (default: 90%)
- [x] Include: candidate name, score, top strengths, job applied for
- [x] Optional: Slack/Teams webhook integration

### 5.3 Supabase Realtime Dashboard
- [x] Enable Realtime on `analysis_results` table in Supabase
- [x] Subscribe to `INSERT` events in the frontend dashboard
- [x] Animate new candidate cards appearing when batch upload completes
- [x] Show live counter ("3 of 12 CVs processed…")
- [x] Optional: toast notifications for each new analysis

---

## Phase 6: Scale & Intelligence ✅

### 6.1 Vector Database — RAG for AI Chat ✅
- [x] Enable `pgvector` extension in Supabase
- [x] Generate embeddings using specialized `gemini-embedding-2-preview` (Matryoshka 768d)
- [x] Store embeddings in a `candidate_embeddings` table
- [x] Update Chat Service to do semantic search (match_candidates RPC)
- [x] Achieved context-grounded AI responses with high scalability

### 6.2 Multi-Language OCR (Arabic CV Support) ✅
- [x] Support image-based CV parsing (Using Gemini Multimodal OCR)
- [x] Support `.jpg`, `.png`, `.tiff` uploads
- [x] Arabic text extraction with proper right-to-left paragraph ordering

### 6.3 DOCX & Image CV Support (§3.2) ✅
- [x] Install `mammoth` for `.docx` parsing
- [x] Extract text content preserving structure
- [x] Update file upload to accept `.docx`, `.jpg`, `.png`

### 6.4 AI Spending Dashboard ✅
- [x] Track token usage per Gemini API call (input + output tokens)
- [x] Store in `ai_usage_logs` table (timestamp, user, operation, tokens, est. cost)
- [x] Build dashboard page with charts (Recharts)
- [x] Complete token tracking and cost estimation visualization
- [x] Add automated alert thresholds for budget management

### 6.5 UI Refactor & Advanced Personalization ✅
- [x] **AI Insights UI Refactor**: Moved insights to a dedicated full-width analytics dashboard.
- [x] **Advanced Recruiter Settings**: Implemented scoring thresholds (Exceptional/Reject), duplicate strategies, and AI focus modes.
- [x] **Full Localization Fix**: Resolved all translation gaps in Arabic for charts, tooltips, and settings.
- [x] **PII Masking**: Added privacy controls to hide candidate-sensitive data from AI prompts.

### 6.6 Reliability & Quota Resilience ✅
- [x] **Atomic Ingestion**: Create application record *before* AI analysis to ensure visibility even if Gemini fails.
- [x] **AI Error Persistence**: Store `ai_error` and `failed` status in the database for UI feedback (error badges + tooltips).
- [x] **Quota-Aware Sync**: Defer Gmail "Mark as Read" until AI success; gracefully halt sync on AI 429 quota errors.
- [x] **Manual Retry UI**: Added "Retry AI Analysis" button to re-process candidates after quota reset.
- [x] **Unified Webhooks**: Centralized alerts in `analyzeForJob` to trigger for Email, Manual, and Retry paths consistently.

---

## Deployment Verification Status

> **Status: ✅ COMPLETED**

- [x] Verify frontend build on Vercel
- [x] Verify backend health check on Render
- [x] Verify connectivity between Frontend and Backend
- [x] Test Gmail/OAuth2 callback in production
- [x] Test Microsoft/Graph callback in production

---

## Phase 7: Expansion 🔮 *IN PROGRESS*

### 7.1 Outlook / Microsoft Graph Integration (§3.2) ✅
- [x] Microsoft OAuth2 flow (Azure AD app registration)
- [x] Graph API — scan inbox for CV attachments
- [x] Reuse existing email processor pipeline
- [x] **Microsoft Graph SendMail**: Unified webhook alerting for Microsoft users.
- [x] **Microsoft CV Download**: Proxy download for attachments via Graph API.

### 7.2 Maintenance & Polishing ✅
- [x] **Deployment Speed**: Implemented 3-stage multi-stage Docker build for ultra-fast Render deployments.
- [x] **UI/UX Overhaul**: Deep Glassmorphism redesign for Login, About, and Settings.
- [x] **Global CSS Fixes**: Aggressive scrollbar hiding and search bar autofill prevention.
- [x] **Navigation**: Improved back button logic on About page.

### 7.3 LinkedIn / GitHub Enrichment (§9)
- [ ] Input LinkedIn URL → scrape public profile data
- [ ] Input GitHub username → fetch repos, languages, contribution stats
- [ ] Augment AI analysis with external profile data

### 7.4 Mobile App — Flutter (§5)
- [ ] Flutter project setup targeting iOS + Android
- [ ] Implement core screens: Dashboard, Job Detail, Candidate Detail, Chat
- [ ] Push notifications for exceptional candidates
- [ ] Camera-based CV scanning (take photo → OCR → analyze)

### 7.5 Multi-Company SaaS (§9)
- [ ] Organization/tenant model with separate data partitions
- [ ] Subscription billing (Stripe integration)
- [ ] Custom branding per organization

### 7.6 Role-Based Access Control (§7)
- [ ] Roles: Admin, Recruiter, Viewer
- [ ] Admin: full access + settings + user management
- [ ] Recruiter: create jobs, upload CVs, use AI Chat
- [ ] Viewer: read-only dashboard access
- [ ] Supabase Row Level Security (RLS) policies

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, Tailwind CSS v4, next-intl |
| Backend | NestJS, TypeScript, SWC |
| Database | Supabase (PostgreSQL + Realtime + Storage) |
| AI | Gemini API (gemini-2.0-flash) |
| Vector DB | Supabase pgvector |
| OCR | Gemini multimodal + Google Cloud Vision |
| PDF Export | Puppeteer-core + @sparticuz/chromium |
| Email | Gmail API, Microsoft Graph API, SendGrid |
| Charts | Recharts |
| Kanban DnD | @dnd-kit/core |
| Auth | Google OAuth2, Azure AD / Microsoft OAuth2 |

---

## Priority Order of Implementation

```
Phase 6 → Phase 7 (In Progress)
```
