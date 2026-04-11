# SILA: AI Recruitment Intelligence System

[English Version](#english-version) | [النسخة العربية](#النسخة-العربية)

---

<div id="english-version">

<p align="center">
  <img src="./assets/logo.png" alt="SILA Logo" width="180" />
</p>

<h1 align="center">🚀 SILA</h1>
<p align="center"><strong>AI Recruitment Intelligence System</strong></p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16--black?logo=next.js" alt="Next.js" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11--red?logo=nestjs" alt="NestJS" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-blue?logo=supabase" alt="Supabase" /></a>
  <a href="https://ai.google.dev/"><img src="https://img.shields.io/badge/Gemini-3.1--Flash--Lite-orange?logo=google-gemini" alt="Gemini API" /></a>
</p>

---

**SILA** is an enterprise-grade AI-powered platform designed for HR teams to automate and enhance the candidate selection process. By leveraging **Gemini 3.1 Flash Lite**, it transforms raw resume data into deep recruitment intelligence, providing explainable scores and semantic search capabilities.

### 🧠 The AI Recruitment Brain

*   **Deep Analysis**: Multi-dimensional scoring evaluating **Skills, GPA, Language, and Cultural Fit** with automated justifications.
*   **Explainable Decisions**: AI-generated reports highlighting strengths, weaknesses, and direct hiring recommendations.
*   **Multimodal Processing**: High-fidelity text extraction from **PDF, DOCX**, and images using Gemini's multimodal vision.

### 📥 Intelligent Automation

*   **Email Integration**: Automated CV collection from Gmail and Outlook via secure OAuth2 pipelines.
*   **AI Job Architect**: Generate production-ready job descriptions from simple natural language inputs.
*   **Executive Reporting**: Board-ready PDF exports with ranked candidate shortlists and scoring breakdowns.

### 📊 Advanced Analytics & RAG

*   **Real-time Insights**: Track hiring performance, token consumption, and operational costs on a high-density dashboard.
*   **Semantic RAG Search**: Query huge candidate pools using natural language (e.g., *"Find experienced AI engineers with industrial background"*).
*   **Kanban Workflow**: Visual, drag-and-drop pipeline management from application to final offer.

### 🖼️ Visual Walkthrough

| Dashboard & Kanban | Candidate Scoring |
| :--- | :--- |
| ![Dashboard](./assets/sila-kanban.png) | ![Scorecard](./assets/sila-candidate-list.png) |
| *Visualizing the recruitment funnel with Kanban* | *Multi-dimensional scoring and analysis* |

| AI Reasoning & Analysis | Strategic Interview Prep |
| :--- | :--- |
| ![AI Analysis](./assets/sila-ai-analysis.png) | ![Strategic Prep](./assets/sila-strategic-prep.png) |
| *Explainable AI showing reasoning chains* | *Context-aware interview questions and roadmaps* |

| AI Agent & Chat | Email Integration |
| :--- | :--- |
| ![AI Chat](./assets/sila-ai-chat.png) | ![Email Integration](./assets/sila-email-integration.png) |
| *Bilingual AI Assistant for candidate interaction* | *Seamless Gmail/Outlook automation* |

| Bilingual Reports | Neural Intelligence |
| :--- | :--- |
| ![Bilingual Report](./assets/sila-bilingual-report.png) | ![Neural Intelligence](./assets/sila-neural-intelligence.png) |
| *Professional reports in English & Arabic* | *Deep profile insights and trajectory prediction* |

### 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js 16)"
        A[Dashboard] --> B[Job Panel]
        A --> C[Kanban Board]
        A --> D[AI Insights]
    end

    subgraph "Backend (NestJS)"
        E[API Gateway] --> F[Candidates Service]
        F --> G[Gemini AI Engine]
        E --> H[Chat Service]
        E --> L[Email Processor]
    end

    subgraph "Data Layer (Supabase)"
        I[(PostgreSQL)]
        J[pgvector / Semantic DB]
        K[Realtime Updates]
    end

    A --> E
    G --> I
    H --> J
    I --> K
```

### 🛠️ Tech Stack

*   **Core**: Next.js 16 (App Router), React 19, TypeScript
*   **Styling**: Tailwind CSS v4 (CSS-first configuration)
*   **Backend**: NestJS, Puppeteer (for PDF generation), Nodemailer
*   **AI**: Gemini 3.1 Flash Lite, LangChain (RAG)
*   **Database**: Supabase (PostgreSQL, Vector Search, Auth, Storage)

---

</div>

<div id="النسخة-العربية" dir="rtl">

<p align="center">
  <img src="./assets/logo.png" alt="شعار SILA" width="180" />
</p>

<h1 align="center">🚀 نظام SILA الذكي</h1>
<p align="center"><strong>نظام ذكاء التوظيف المعزز بالذكاء الاصطناعي</strong></p>

---

**SILA** هو نظام احترافي مدعوم بالذكاء الاصطناعي، مصمم خصيصاً لفرق الموارد البشرية لأتمتة وتحسين عملية اختيار المرشحين. من خلال دمج تقنيات **Gemini 3.1**، يقوم النظام بتحويل السير الذاتية المعقدة إلى رؤى استراتيجية تدعم اتخاذ القرار.

### 🧠 عقل التوظيف الذكي

*   **التحليل العميق**: تقييم متعدد الأبعاد يشمل **المهارات، المعدل، اللغات، والجاهزية المهنية** مع مبررات آلية.
*   **قرارات مفسرة**: تقارير مولدة آلياً توضح نقاط القوة والضعف وتوصيات التوظيف المباشرة.
*   **المعالجة الذكية للمستندات**: استخراج نصوص عالي الدقة من ملفات **PDF، DOCX**، والصور باستخدام رؤية Gemini الحاسوبية.

### 📥 الأتمتة والتقارير الاحترافية

*   **الربط مع البريد الإلكتروني**: جمع السير الذاتية تلقائياً من Gmail و Outlook عبر بروتوكولات OAuth2 الآمنة.
*   **مهندس الوظائف الذكي**: توليد وصف وظيفي محترف من مدخلات بسيطة بلغة طبيعية.
*   **التقارير التنفيذية**: تصدير ملفات PDF احترافية تعرض تصنيفات المرشحين وتفاصيل التقييم لمشاركتها مع الإدارة.

### 📊 التحليلات المتقدمة والبحث الدلالي

*   **لوحة الرؤى اللحظية**: تتبع أداء التوظيف، استهلاك الرموز، وتكاليف العمليات عبر لوحة تحكم متطورة.
*   **البحث الدلالي (RAG)**: ابحث في قاعدة بيانات المرشحين باستخدام اللغة الطبيعية (مثال: *"ابحث عن مهندسين ذكاء اصطناعي ذوي خبرة صناعية"*).
*   **إدارة مراحل التوظيف**: مسار توظيف مرئي يعتمد على السحب والإفلات لإدارة المرشحين من التقديم حتى العرض الوظيفي.

### 🖼️ معرض الصور الملحق

| لوحة التحكم وكانبان | تقييم المرشحين |
| :--- | :--- |
| ![Dashboard](./assets/sila-kanban.png) | ![Scorecard](./assets/sila-candidate-list.png) |
| *عرض مسار التوظيف باستخدام نظام كانبان* | *نظام تقييم وتصنيف متعدد الأبعاد* |

| تحليل الذكاء الاصطناعي | التحضير الاستراتيجي للمقابلات |
| :--- | :--- |
| ![AI Analysis](./assets/sila-ai-analysis.png) | ![Strategic Prep](./assets/sila-strategic-prep.png) |
| *توضيح آلية اتخاذ القرار وسلسلة التفكير* | *أسئلة مقابلة مخصصة وخرائط طريق مهنية* |

| المساعد الذكي والدردشة | التكامل مع البريد الإلكتروني |
| :--- | :--- |
| ![AI Chat](./assets/sila-ai-chat.png) | ![Email Integration](./assets/sila-email-integration.png) |
| *مساعد ذكي ثنائي اللغة للتفاعل مع البيانات* | *أتمتة كاملة مع Gmail و Outlook* |

| التقارير ثنائية اللغة | الذكاء العصبي |
| :--- | :--- |
| ![Bilingual Report](./assets/sila-bilingual-report.png) | ![Neural Intelligence](./assets/sila-neural-intelligence.png) |
| *تقارير احترافية باللغتين العربية والإنجليزية* | *تحليلات عميقة للملف الشخصي وتنبؤات المسار الوظيفي* |

---
*صُنع بكل حب بواسطة فريق SILA*

</div>
