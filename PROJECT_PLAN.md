# 📋 SILA Implementation Backlog (March 2026)

> This document tracks granular implementation tasks for the AI Recruitment Intelligence System.

---

## 🏢 Phase 8: AI Intelligence & Optimization ✅
*Target: Enhancing search accuracy, cost efficiency, and autonomous agent capabilities.*

### 8.1 Native AI Reliability & Structure ✅
- [x] Implement Gemini `responseSchema` for 100% valid JSON analysis
- [x] Eliminate regex-based JSON cleaning in `AiService`
- [x] Define strict OpenAPI-compliant schemas for candidate analysis

### 8.2 Actionable AI Assistant (Function Calling) ✅
- [x] Integrate Gemini Function Calling into `ChatService`
- [x] Implement `update_candidate_stage` tool (Supabase PATCH)
- [x] Implement `update_job_requirements` tool (Supabase PATCH)
- [x] Add multi-turn tool execution loop in Chat RAG
- [x] **Intelligence Expansion (Batch A: Engagement)** ✅
    - [x] Implement `generate_interview_guide` (Customized technical rubrics)
    - [x] Implement `send_rejection_email` (AI-drafted personalized rejection)
    - [x] Implement `draft_offer_letter` (Automated candidate offer generation)
- [x] **Intelligence Expansion (Batch B: Strategy)** ✅
    - [x] Implement `cross_match_candidate` (Find better roles for candidates)
    - [x] Implement `salary_benchmarking` (Market-aligned offer suggestions)
    - [x] Implement `hiring_risk_assessment` (Red flag & gap detection)
- [x] **Intelligence Expansion (Batch C: Efficiency)** ✅
    - [x] Implement `bulk_archive_candidates` (Clean up the pipeline)
    - [x] Implement `find_duplicate_candidates` (Semantic identity check)
    - [x] Implement `export_candidate_report` (PDF generation via Puppeteer)

### 8.3 Hybrid Search RAG Optimization ✅
- [x] Implement weighted Hybrid Search (Semantic Vector + Keyword Full-Text)
- [x] Update Supabase `match_candidates` RPC for BM25-style ranking
- [x] Add `tsvector` columns to `candidate_embeddings` for rare keyword recall

### 8.4 AI Context Caching ✅
- [x] Implement TTL-based Context Caching for repeated RAG queries
- [x] Reduce token costs for long chat sessions by up to 90%
- [x] Build `cacheContent` wrapper in `AiService` (In-memory TTL cache)

### 8.5 Multimodal CV Layout Analysis ✅
- [x] Use Gemini Vision to evaluate CV structural professionalism
- [x] Add "Design & Presentation" score (0-100) to analysis table
- [x] Visualize hierarchy quality in candidate dashboard

### 8.6 Reasoning-Based Interviews ✅
- [x] Switch `interview_questions` to Gemini 3.1 Pro reasoning model
- [x] Implement "Trap Questions" to verify claimed technical skills
- [x] Add "Reasoning Trace" to AI justifications

---

## 🌐 Phase 9: Ecosystem & Enterprise Scaling ⏳
*Target: External data augmentation and mobile accessibility.*

### 9.1 LinkedIn / GitHub Profile Enrichment
- [ ] Input LinkedIn URL → Scrape professional profile data
- [ ] Input GitHub username → Fetch contribution frequency & repo tech stack
- [ ] Augment AI scoring with external "Proof of Work" evidence

### 9.2 Mobile App — Flutter Implementation
- [ ] **Strict Isolation Setup**: Initialize Flutter project (`frontend_mobile/`) without modifying backend/web.
- [ ] **Tech Stack Initialization**: Install `flutter_riverpod`, `go_router`, and `supabase_flutter`.
- [ ] **Bilingual Infrastructure**: Configure `flutter_localizations` (RTL/LTR).
- [ ] **Authentication**: Supabase native Google/Microsoft OAuth via Deep Links.
- [ ] **Dashboard**: Mobile-optimized rapid-review list matching web glassmorphism UI.
- [ ] **Candidate Profile**: CV Viewer and `flutter_cached_pdfview` for generated reports.
- [ ] **AI Chat**: `flutter_markdown` integration for clickable RAG assistance on mobile.
- [ ] Real-time push notifications via Firebase/Supabase.
- [ ] Camera integration for instant CV ingestion.

### 9.3 Multi-Company SaaS & RBAC
- [ ] Organization-based data partitioning (Tenant ID)
- [ ] Stripe integration for "Credits-per-Analysis" billing
- [ ] Role-Based Access: Admin (Full), Recruiter (Standard), Viewer (Read-only)
- [ ] Supabase RLS policies for tenant isolation

### 9.4 WhatsApp CV Verification Bot ⏳ PLANNED
*Target: AI-powered WhatsApp bot to verify candidate CV authenticity via rapid-fire Q&A.*

- [ ] **Twilio Integration**: Install `twilio` SDK, implement `TwilioService` (send/receive/webhook)
- [ ] **Database Schema**: Create `whatsapp_verification_sessions` + `verification_questions` tables with RLS
- [ ] **Phone Extraction**: Extend `AiService.extractCandidateInfo()` to extract phone numbers from CVs
- [ ] **Pipeline Stage**: Add `whatsapp_verification` stage to applications pipeline (between Screening & Interview)
- [ ] **VerificationService State Machine**: Consent → Language → Availability → Q&A → Analysis
- [ ] **AI Question Generation**: Gemini generates 3-5 unique verification questions per candidate CV in Libyan Arabic dialect
- [ ] **AI Authenticity Analysis**: Multi-signal fraud detection (timing, linguistics, CV consistency, internet patterns)
- [ ] **Conversation Flow**: Natural Libyan Arabic dialect (bilingual EN/AR fallback)
- [ ] **Twilio Webhook**: Incoming message handler for real-time candidate responses
- [ ] **Session Timeout**: Auto-expire unresponsive sessions, send reminders
- [ ] **Frontend Settings**: WhatsApp config section in `SettingsModal` (Twilio SID/Token, question count, timeout)
- [ ] **Frontend Dashboard**: "Verify via WhatsApp" button on Kanban cards, `WhatsAppResults` panel
- [ ] **Function Calling**: Add `start_whatsapp_verification` and `get_verification_results` tools to `ChatService`
- [ ] **i18n**: EN + AR translations for all WhatsApp UI elements

---

## 🛠 Tech Stack Snapshot

| Layer | Component | Version / Spec |
|:---|:---|:---|
| **Frontend** | Next.js 16 | App Router, React 19, Tailwind v4 |
| **Backend** | NestJS | TypeScript, SWC, Puppeteer |
| **AI Model** | Gemini 3.1 Flash-Lite | Native JSON Mode, Function Calling |
| **RAG** | pgvector | Matryoshka 768d Embeddings |
| **Data** | Supabase | PostgreSQL + Realtime + Auth |
