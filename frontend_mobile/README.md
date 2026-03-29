# SILA Mobile (Flutter)

Mobile companion application for the **AI Recruitment Intelligence System (SILA)**.

## 🚀 Features
- **Dashboard**: Rapid review of candidates with AI Match Scores.
- **Search & Filter**: Find candidates by name, email, or specific job roles.
- **Quick Actions**: Update candidate stages or delete profiles on the go.
- **AI Chat**: Fully integrated SILA Assistant with RAG context and Markdown support.
- **Candidate Profile**: Deep dive into AI insights and native PDF viewing for CVs.
- **Bilingual**: Full support for English and Arabic layouts.

## 🛠 Tech Stack
- **Framework**: Flutter (Dart)
- **State Management**: Riverpod (Notifier)
- **Navigation**: GoRouter
- **Backend/Auth**: Supabase Flutter SDK
- **API**: NestJS (REST)

## 📦 Setup & Running

1. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your Supabase credentials and Backend API URL.
   ```bash
   cp .env.example .env
   ```

2. **Dependencies**:
   ```bash
   flutter pub get
   ```

3. **Run**:
   ```bash
   flutter run
   ```

## 🛡️ Architecture
This mobile app is built using a **feature-first** clean architecture pattern:
- `lib/core`: Shared themes, routers, and constants.
- `lib/features`: Domain-driven features (Auth, Dashboard, Chat, Settings).
- `lib/shared`: Common UI components used across the app.

---
*Developed as part of the SILA Ecosystem (March 2026).*
