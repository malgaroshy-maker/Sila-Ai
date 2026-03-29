# AGENTS.md

Welcome, Agent! This repository hosts the **AI Recruitment Intelligence System (SILA)**—an enterprise-grade platform for HR teams to automate candidate selection using Gemini-powered analysis, RAG-based search, and multi-channel integration.

## 1. Project Context & Architecture
SILA is a monorepo designed for high-performance, AI-driven recruitment workflows.

- **/backend-api**: NestJS, TypeScript, Supabase (PostgreSQL + `pgvector`), Gemini API (`gemini-3.1-flash-lite`), Puppeteer (`@sparticuz/chromium`) for PDF reporting.
- **/frontend-web**: Next.js 16 (App Router), React 19, Tailwind CSS v4, `next-intl` (i18n), Framer Motion, Recharts.
- **/frontend_mobile**: Future Flutter application.

---

## 2. Build, Lint, and Test Commands

### 2.1 Monorepo (Root)
- **Install All:** `npm run install:all` (Installs dependencies for both backend and frontend)
- **Start All:** `npm run dev` (Runs backend and frontend concurrently)
- **Windows Start:** `npm run dev:windows` (Launches two separate PowerShell windows)

### 2.2 Backend (`/backend-api`)
- **Dev Server:** `npm run start:dev` (NestJS watch mode)
- **Build:** `npm run build`
- **Lint:** `npm run lint` (ESLint with auto-fix)
- **Test All:** `npm run test` (Jest)
- **Test Single File:** `npx jest <path-to-test-file.spec.ts>` (e.g., `npx jest src/candidates/candidates.service.spec.ts`)
- **Test E2E:** `npm run test:e2e`

### 2.3 Frontend (`/frontend-web`)
- **Dev Server:** `npm run dev` (Next.js dev)
- **Build:** `npm run build`
- **Lint:** `npm run lint`

---

## 3. Tech Stack & Domain Rules

### 3.1 Frontend: Next.js 16 & Tailwind v4
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
This version uses Next.js 16 and React 19. APIs and conventions differ from training data:
- **RSC by Default:** Use Server Components for data fetching. Use `"use client"` only for interactivity/hooks.
- **Async APIs:** `cookies()`, `headers()`, and `params` (in Page/Layout) are now Promises. Always `await` them.
- **Tailwind v4:** Uses CSS-first configuration. Use logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) for RTL compatibility.
<!-- END:nextjs-agent-rules -->

- **i18n & RTL:** Full support for Arabic/English via `next-intl`. Use logical properties instead of physical ones (e.g., `start` and `end` instead of `left` and `right`).
- **State Management:** Use Server Actions and URL-based state where possible. Limit Client State to complex UI components.
- **Icons:** Exclusively use `lucide-react`.

### 3.2 Backend: NestJS & Supabase
- **AI Integration:** Exclusively use the Gemini API (Focus on 2.5, 3, 3.1 series). Do not use OpenAI or other providers.
- **Database:** Supabase PostgreSQL with `pgvector` for RAG.
- **Multi-Tenancy:** **CRITICAL:** Every single query MUST filter by the authenticated `user_email` to ensure strict data isolation between HR accounts.
- **PDF Generation:** Use `@sparticuz/chromium` in the backend for generating reports to keep the Docker image size minimal.

---

## 4. Code Style & Engineering Guidelines

### 4.1 TypeScript & Typing
- **No `any`:** Use `unknown` if a type is truly uncertain.
- **Strict Interfaces:** Explicitly type all function parameters and return values.
- **Naming:**
  - **Interfaces/Types:** `PascalCase`. No "I" prefix.
  - **Classes/Components:** `PascalCase`.
  - **Variables/Functions:** `camelCase`.
  - **Booleans:** Prefix with `is`, `has`, `should`, or `can` (e.g., `isAnalyzing`, `hasCV`).
  - **Constants:** `UPPER_SNAKE_CASE`.

### 4.2 File Structure & Naming
- **Backend:** Feature-based directories. Files follow `<feature>.<type>.ts` pattern (e.g., `candidates.service.ts`, `jobs.controller.ts`).
- **Frontend:** Kebab-case for filenames (`candidate-card.tsx`). Follow App Router directory conventions (`page.tsx`, `layout.tsx`, `loading.tsx`).

### 4.3 Imports & Formatting
- **Backend:** Use relative paths (e.g., `import { Service } from '../service'`).
- **Frontend:** Use the `@/` alias for root-level imports (e.g., `import { Button } from '@/components/ui/button'`).
- **Formatting:** Adhere to Prettier settings. Max line length is 120 chars.

### 4.4 Error Handling
- **Backend:** Wrap critical logic in try/catch. Throw appropriate NestJS `HttpException` (e.g., `BadRequestException`, `InternalServerErrorException`).
- **Frontend:** Implement user-friendly error boundaries and toast notifications. Use `error.tsx` for route-level crash handling.

---

## 5. Security & Deployment
- **Secrets:** Never commit `.env` files. Access secrets via `ConfigService` (Backend) or `process.env` (Frontend).
- **PII Masking:** Be mindful of PII in logs. Mask candidate emails and phone numbers in debug logs.
- **Docker:** Use the multi-stage Docker build (`Dockerfile` in root or backend) for optimized Render/Cloud deployments.
- **Microsoft/Google OAuth:** Implement throttling and batching for API calls. Use `quotaUser` for Gmail/Graph API requests.

## 6. Proactive Task Completion
- When adding a feature, ensure:
  1. Types are defined.
  2. Translations are added to `messages/en.json` and `messages/ar.json`.
  3. Tests are written or updated.
  4. Logical properties are used in CSS/Tailwind for RTL support.

## 7. AI Implementation Standards (2026)
- **JSON Mode**: Always use `responseSchema` in `AiService`. Never use regex to clean AI strings.
- **Function Calling**: Register new system actions in `ChatService.handleFunctionCall` and update the `tools` declaration.
- **Temporal Context**: Every AI prompt must include `Today's Date` (Already implemented in `AiService` helpers).
- **Quota Resilience**: Check `live_api_status` table before making heavy batch calls.

---
- **Quota Resilience**: Check `live_api_status` table before making heavy batch calls.

## 8. Mobile App Development Constraints (Strict Isolation)
When developing the Flutter mobile application (`frontend_mobile/`), you MUST adhere to the following rules to ensure zero impact on the existing stable web and backend systems:
1. **Strict Isolation**: Do NOT modify ANY files in `backend-api/` or `frontend-web/` to accommodate the mobile app. The mobile app must adapt to the existing backend API contracts.
2. **Authentication**: The mobile app will use `supabase_flutter` for local session management but must communicate with the NestJS backend using the existing `x-user-email` HTTP header pattern for multi-tenancy.
3. **API Consumption**: Treat the NestJS API as a rigid, external third-party service. If a mobile feature requires a backend change, you must explicitly flag it as a breaking change and seek user approval before modifying the backend.
4. **No Infinite Loops**: The web and backend platforms are considered complete and stable for Phase 8. Do not refactor them unless explicitly instructed.

---
*Updated on 2026-03-29. Follow these rules to maintain project integrity.*
