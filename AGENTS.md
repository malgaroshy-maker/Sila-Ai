# AGENTS.md

Welcome, Agent! You are operating in the **AI Recruitment Intelligence System** repository. This is an advanced AI-powered platform for HR teams to collect, analyze, rank, and select candidates using the Gemini API.

## 1. Project Context & Architecture
This is a monorepo building an "AI Recruitment Brain" that features CV parsing, multi-scoring (Skills, GPA, Language, Readiness), AI Chat with RAG (`pgvector`), email integration, and a Kanban board.

- `/backend-api`: NestJS, TypeScript, Supabase, Gemini API (`gemini-2.0-flash`), Puppeteer (PDF reports).
- `/frontend-web`: Next.js 16 (App Router), Tailwind CSS v4, `next-intl` (Arabic/English RTL), `@dnd-kit/core` (Kanban), Recharts.
- `/frontend_mobile`: Future Flutter application.

## 2. Build, Lint, and Test Commands

### 2.1 Monorepo (Root)
- **Install All:** `npm run install:all`
- **Start All:** `npm run dev` (Use `npm run dev:windows` on Windows)

### 2.2 Backend (`backend-api`)
- **Dev Server:** `npm run start:dev`
- **Build/Lint:** `npm run build` / `npm run lint`
- **Test All:** `npm run test`
- **Test Single File:** `npm run test -- <path-to-test-file.spec.ts>`
- **Test E2E:** `npm run test:e2e`

### 2.3 Frontend (`frontend-web`)
- **Dev Server:** `npm run dev`
- **Build/Lint:** `npm run build` / `npm run lint`

## 3. Domain-Specific Rules & Tech Stack

### 3.1 Frontend (Next.js 16 & Tailwind v4)
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version has breaking changes. APIs, conventions, and file structure differ from training data. Read `node_modules/next/dist/docs/` before writing code.
<!-- END:nextjs-agent-rules -->
- **i18n & RTL:** Support English/Arabic via `next-intl`. Use CSS logical properties (e.g., `ms-4`, `start/end`) instead of physical ones (`ml-4`, `left/right`).
- **Server Components:** RSC by default. Use `"use client"` only for hooks/events.
- **Cookies:** `cookies()` is now a Promise; always `await` it.
- **Dynamic Routes:** Use `export const dynamic = 'force-dynamic'` for routes accessing cookies or headers.

### 3.2 Backend (NestJS & Supabase)
- **AI Integration:** Exclusively use Gemini API.
- **Database:** Supabase PostgreSQL with `pgvector`.
- **Tenancy:** Filter ALL queries by the authenticated `user_email` to ensure data isolation.

## 4. Code Style & Engineering Guidelines

### 4.1 TypeScript & Typing
- **Strict Typing:** No `any`. Use `unknown` if necessary. Provide explicit types for all parameters/return types.
- **Interfaces/Types:** `PascalCase` for objects/interfaces. Use `type` for unions. No "I" prefix for interfaces (e.g., `interface Candidate`, not `interface ICandidate`).

### 4.2 Naming Conventions
- **Backend:** `<feature>.<type>.ts` (e.g., `candidates.service.ts`).
- **Frontend:** `kebab-case.tsx` or App Router conventions (`page.tsx`, `layout.tsx`).
- **Classes/Components:** `PascalCase`.
- **Functions/Variables:** `camelCase`. Prefix booleans with `is`, `has`, `should`.
- **Constants:** `UPPER_SNAKE_CASE`.

### 4.3 Error Handling
- **Backend:** Wrap in try/catch. Throw NestJS HTTP Exceptions (`BadRequestException`, etc.). Never leak raw errors to client.
- **Frontend:** Use try/catch with user-friendly toast notifications. Use `error.tsx` for route-level crashes.

### 4.4 Operational Rules
- **Proactiveness:** Complete full scope (translations, types, tests).
- **Comments:** Explain *why*, not *what*.
- **Commits:** Only when asked. Use `feat:`, `fix:`.
- **Pathing:** Use absolute paths for file tools. Verify existence with `glob`/`bash` first.
- **Deployment:** Always use `process.env.NEXT_PUBLIC_API_URL`. Ensure all Gmail/API calls implement throttling/batching with `quotaUser`.
