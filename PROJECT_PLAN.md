# 📋 SILA implementation Backlog (March 2026)

> This document tracks granular implementation tasks for the AI Recruitment Intelligence System.

---

## 🏢 Phase 8: AI Intelligence & Optimization 🚀
*Current Priority: Enhancing search accuracy and cost efficiency.*

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

### 8.5 Multimodal CV Layout Analysis
- [ ] Use Gemini Vision to evaluate CV structural professionalism
- [ ] Add "Design & Presentation" score (0-100) to analysis table
- [ ] Visualize hierarchy quality in candidate dashboard

### 8.6 Reasoning-Based Interviews
- [ ] Switch `interview_questions` to Gemini 3.1 Pro reasoning model
- [ ] Implement "Trap Questions" to verify claimed technical skills
- [ ] Add "Reasoning Trace" to AI justifications

---

## 🌐 Phase 9: Ecosystem & Enterprise Scaling ⏳
*Target: External data augmentation and mobile accessibility.*

### 9.1 LinkedIn / GitHub Profile Enrichment
- [ ] Input LinkedIn URL → Scrape professional profile data
- [ ] Input GitHub username → Fetch contribution frequency & repo tech stack
- [ ] Augment AI scoring with external "Proof of Work" evidence

### 9.2 Mobile App — Flutter Implementation
- [ ] iOS/Android project setup with common SILA API
- [ ] Real-time push notifications for "Exceptional" candidates
- [ ] Mobile camera integration for instant "Photo-to-Analysis" CV ingestion

### 9.3 Multi-Company SaaS & RBAC
- [ ] Organization-based data partitioning (Tenant ID)
- [ ] Stripe integration for "Credits-per-Analysis" billing
- [ ] Role-Based Access: Admin (Full), Recruiter (Standard), Viewer (Read-only)
- [ ] Supabase RLS policies for tenant isolation

---

## 🛠 Tech Stack Snapshot

| Layer | Component | Version / Spec |
|:---|:---|:---|
| **Frontend** | Next.js 16 | App Router, React 19, Tailwind v4 |
| **Backend** | NestJS | TypeScript, SWC, Puppeteer |
| **AI Model** | Gemini 3.1 Flash-Lite | Native JSON Mode, Function Calling |
| **RAG** | pgvector | Matryoshka 768d Embeddings |
| **Data** | Supabase | PostgreSQL + Realtime + Auth |
