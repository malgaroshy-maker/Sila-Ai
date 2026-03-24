# AGENTS.md

Welcome, Agent! You are operating in the **AI Recruitment Intelligence System** repository. 
This is an advanced AI-powered platform for HR teams to collect, analyze, rank, and select candidates using the Gemini API.

## 1. Project Context & Architecture
This is a monorepo building an "AI Recruitment Brain" that features CV parsing, multi-scoring (Skills, GPA, Language, Readiness), AI Chat with RAG (pgvector), email integration, and a Kanban board.
- `/backend-api`: NestJS, TypeScript, Supabase, Gemini API (`gemini-2.0-flash`), Puppeteer (PDF reports).
- `/frontend-web`: Next.js 15, Tailwind CSS v4, `next-intl` (Arabic/English RTL), `@dnd-kit/core` (Kanban), Recharts.
- `/frontend_mobile`: Future Flutter application.

**Current State:** Phases 1-5 completed (Core AI, Kanban, Chat, Reports, i18n). Currently entering Phase 6 (Multi-Language OCR, AI Spending Tracking, DOCX support).

## 2. Build, Lint, and Test Commands

### 2.1 Monorepo (Root)
- **Install All:** `npm run install:all`
- **Start All:** `npm run dev` (Use `npm run dev:windows` on Windows)

### 2.2 Backend (`backend-api`) - Run inside directory
- **Dev Server:** `npm run start:dev`
- **Build/Lint:** `npm run build` / `npm run lint`
- **Test All:** `npm run test`
- **Test Single File:** `npm run test -- <path-to-test-file.spec.ts>`
- **Test E2E / Coverage:** `npm run test:e2e` / `npm run test:cov`

### 2.3 Frontend (`frontend-web`) - Run inside directory
- **Dev Server:** `npm run dev`
- **Build/Lint:** `npm run build` / `npm run lint`

## 3. Domain-Specific Rules & Tech Stack

### 3.1 Frontend (Next.js 15 & Tailwind v4)
<!-- BEGIN:nextjs-agent-rules -->
**This is NOT the Next.js you know**
This version has breaking changes — APIs, conventions, and file structure differ from training data. Read `node_modules/next/dist/docs/` before writing code.
<!-- END:nextjs-agent-rules -->
- **i18n & RTL:** The app supports English and Arabic via `next-intl`. **ALWAYS** use CSS logical properties (e.g., `ms-4` instead of `ml-4`, `start/end` instead of `left/right`) to ensure RTL layout compatibility.
- **Server Components:** Components are RSC by default. Only use `"use client"` for hooks, state, or event listeners.

### 3.2 Backend (NestJS & Supabase)
- **AI Integration:** Exclusively use the Gemini API for intelligence features.
- **Database:** Supabase PostgreSQL is the primary store. We use `pgvector` (Matryoshka 768d embeddings) for the RAG AI Chat.
- **Architecture:** Keep logic isolated in Services. Use decorators (`@Controller`, `@Injectable`) and Dependency Injection heavily.
- **Tenancy:** Always filter queries by the authenticated `user_email` to ensure data isolation.

## 4. Code Style & Engineering Guidelines

### 4.1 TypeScript & Typing
- **Strict Typing:** Always provide explicit type annotations for parameters and return types. Avoid `any` completely; use `unknown` if necessary.
- **Interfaces/Types:** Use `PascalCase` without an "I" prefix (e.g., `Candidate`, `Job`). Prefer `interface` for objects and `type` for unions.

### 4.2 Naming Conventions
- **Backend Files:** `<feature>.<type>.ts` (e.g., `candidates.service.ts`).
- **Frontend Files:** `kebab-case.tsx` or App Router conventions (`page.tsx`, `layout.tsx`).
- **Classes/Components:** `PascalCase`.
- **Functions/Variables:** `camelCase`. Prefix booleans with `is`, `has`, `should`.
- **Constants:** `UPPER_SNAKE_CASE`.

### 4.3 Error Handling
- **Backend:** Wrap try/catch blocks and throw NestJS HTTP Exceptions (`BadRequestException`, etc.). Never leak raw errors to the client.
- **Frontend:** Wrap async operations in try/catch and use user-friendly toast notifications. Use React Error Boundaries (`error.tsx`) for route crashes.

### 4.4 Proactiveness & Commits
- Complete the full scope of requested features, including translations (`ar.json`/`en.json`), typings, and tests.
- Do not write obvious comments; explain the *why*, not the *what*.
- Only commit when explicitly asked, using semantic messages (`feat:`, `fix:`).
- Use absolute paths when executing file tools. Do not hallucinate paths; verify with `glob`/`bash` first.