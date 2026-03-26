# ARIS: AI Prompt Engineering & Bilingual Logic

This document outlines the core AI prompt architecture for the **AI Recruitment Intelligence System (ARIS)**. It details how we use Gemini API to achieve high-precision, bilingual (Arabic/English) recruitment insights.

---

## 1. Candidate Analysis Prompt
**Location:** `backend-api/src/ai/ai.service.ts` -> `analyzeCandidate()`

This is our most complex prompt. it takes raw CV text and job requirements to generate a structured 20+-field JSON response.

### The Prompt Structure
```text
أنت مساعد HR خبير وتقوم بمقارنة السيرة الذاتية للمرشح مع متطلبات الوظيفة.

[Job Requirements JSON]
[Raw CV Text Content]

قم بتحليل السيرة الذاتية وإرجاع مخرجات JSON صارمة بالتنسيق التالي بدون أي نص إضافي:
{
  "skills_score": 0... "final_score": 0,
  "is_fresh_graduate": false,
  "cultural_fit_score": 0,
  "career_trajectory": "...",
  "strengths": [...], "weaknesses": [...],
  "justification": "...",
  "interview_questions": [...],
  "training_suggestions": [...]
}

[MODE INSTRUCTIONS: STRICT vs BALANCED]
[FOCUS INSTRUCTIONS: TECHNICAL vs CAREER vs BALANCED]
[LANGUAGE INSTRUCTIONS: AR vs EN vs BH]
[PRIVACY INSTRUCTIONS: MASK PII]
```

### How It Works:
- **Bilingual Hybrid logic:** In "Bilingual" mode, the AI is explicitly told to provide the `justification` in English followed by a professional Arabic translation.
- **Scoring Engine:** It switches logic based on the `is_fresh_graduate` flag. For fresh grads, it ignores "Years of Experience" and instead values "Project Impact" and "Academic Excellence".
- **Dynamic Penalties:** In "Strict" mode, the AI is instructed to give 0 partial credit for missing mandatory tools or technologies.

---

## 2. AI Chat (RAG) Prompt
**Location:** `backend-api/src/chat/chat.service.ts` -> `chat()`

This prompt handles the real-time AI recruitment assistant using **Retrieval-Augmented Generation (RAG)**.

### The Prompt Structure
```text
You are an AI Recruitment Specialist (RAG-Enabled) for the "AI Recruitment Intelligence System".
[LANGUAGE INSTRUCTION: AR/EN/BH]

=== Retrieve Documents Context (RAG) ===
[Relevant CV Snippets from Vector DB]

=== Current Job Openings ===
[Active Jobs Summary]

=== Top Candidate Analysis Overview ===
[Top 20 Candidate Scores and Tags]

=== Guiding Instructions ===
1. LANGUAGE: [Matches preferred setting]
2. ACCURACY: Use RAG context for details.
3. COMPARISON: Use Analysis Overview for ranking.
4. TONE: Professional Executive Recruiter.
```

### How It Works:
- **Context Awareness:** The prompt combines three data sources: specific candidate text snippets (from `pgvector`), general job descriptions, and previous AI scores.
- **Persona Persistence:** It maintains a professional recruiter persona that knows how to compare candidates ("Who is better for X role?") by looking at the `final_score` and `tags` provided in the context.

---

## 3. Job Generation Prompt
**Location:** `backend-api/src/ai/ai.service.ts` -> `generateJobFromText()`

Converts simple human input like *"I want a developer who knows react and nodes and 3 years exp"* into a professional job posting.

### The Prompt Content
```text
You are an HR expert. Convert this natural language job request into a structured job posting.

User request: "{userInput}"

Return ONLY valid JSON with no extra text:
{
  "title": "Job Title",
  "description": "Detailed job description (2-3 sentences)",
  "requirements": ["requirement 1", "requirement 2", "requirement 3"]
}
```

### How It Works:
- **Noise Filtering:** It identifies the core technical requirements from a messy sentence.
- **Professional Expansion:** It expands short acronyms (e.g., "React") into professional context ("Proficiency in React.js and modern frontend architectures").

---

## Technical Implementation Notes:
- **Temperature:** We use a low temperature (around 0.2) for Analysis to ensure deterministic and accurate JSON.
- **TopK/TopP:** Optimized for high-fidelity extraction from long CV documents.
- **Safety Settings:** Configured to allow processing of clinical or technical terms in CVs while maintaining standard safety filters.
