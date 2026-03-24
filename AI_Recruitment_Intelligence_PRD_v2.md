# AI Recruitment Intelligence System - PRD v2

## 1. Overview
Advanced AI-powered system for HR teams to collect, analyze, rank, and select candidates using Gemini API.

## 2. Core Vision
Build an AI Recruitment Brain that:
- Understands job requirements dynamically
- Analyzes candidates deeply
- Explains decisions clearly
- Assists HR, not replaces them

## 3. Key Features

### 3.1 Job Input System
- Form + AI Chat input
- AI converts user intent into structured job description

### 3.2 CV Ingestion
- Gmail & Outlook integration
- Manual upload (PDF, DOCX, Images)
- OCR support for bad-quality CVs

### 3.3 AI Analysis Engine
- Multi-score system:
  - Skills
  - GPA
  - Language
  - Industrial Readiness
- Final Score (0–100)
- Strengths & Weaknesses
- Hiring Recommendation
- Why NOT selected

### 3.4 AI Behavior
- Default: Balanced
- Can switch to Strict via prompt
- Fully explainable decisions

### 3.5 AI Chat (Core System)
- Context-aware
- Works across all candidates
- Example queries:
  - "Best 3 candidates"
  - "Who is ready to work immediately?"
  - "Compare candidate A and B"

### 3.6 Dashboard
- Ranked candidates
- Top performers
- Color-coded scoring:
  - Green (Strong)
  - Yellow (Average)
  - Red (Weak)

### 3.7 Smart Features
- Auto-tagging
- Detect weak CVs
- Detect overqualified candidates
- Suggest training improvements
- Suggest interview questions

### 3.8 Reports
- Executive-level PDF reports
- Includes:
  - Rankings
  - Justifications
  - Insights

## 4. Workflow

Best Practice Flow:
1. Create Job (Form or Chat)
2. Collect CVs (Email / Upload)
3. AI processes CVs
4. Dashboard displays ranked candidates
5. HR interacts with AI Chat
6. Final shortlist selection
7. Export report

## 5. Tech Stack

Frontend:
- Web: Next.js
- Mobile: flutter

Backend:
- Node.js (NestJS preferred)

AI:
- Gemini API

Database:
- PostgreSQL / Supabase

Email:
- Gmail API
- Outlook (Microsoft Graph)

## 6. AI Prompting Strategy

- Structured extraction prompts
- Scoring prompts
- Comparison prompts
- Chat prompts with memory

## 7. Security
- Role-based access
- Secure CV storage
- API key protection

## 8. Development Phases

Phase 1:
- CV upload + AI analysis

Phase 2:
- Email integration + dashboard

Phase 3:
- AI Chat + advanced features

## 9. Future Enhancements
- LinkedIn integration
- SaaS platform
- Multi-company support
