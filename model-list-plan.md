# Gemini Model Management & Quota Awareness Plan

This plan has been updated with real-time model data fetched from the Gemini API and refined to focus on **User-Centric Quota Awareness**.

---

## 1. Verified Model Catalog (March 2026 Edition)

The system now prioritizes the **Gemini 3.1** series, which offers the best reasoning and Arabic linguistic capabilities. All Gemini 2.0 and 1.5 models are considered deprecated for new recruitment tasks.

| Name | Display Name | In/Out Tokens | Tasks | Status |
| :--- | :--- | :--- | :--- | :--- |
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro | 1M / 64K | Scoring, Complex Reasoning | **Primary (High Reasoning)** |
| `gemini-3.1-flash-lite-preview`| Gemini 3.1 Flash Lite| 1M / 64K | CV Parsing, Fast Chat | **Primary (Speed/Cost)** |
| `gemini-embedding-2-preview` | Gemini Embedding 2 | 8K / 1 | Vector Search (RAG) | **Active** |
| `gemini-2.5-pro` | Gemini 2.5 Pro | 1M / 64K | Legacy Support | Deprecated |
| `gemini-2.0-flash` | Gemini 2.0 Flash | 1M / 8K | Legacy Support | Deprecated |

---

## 2. Quota Awareness Architecture
Instead of enforced limits, we implement **Quota Visibility** to help users manage their own API keys effectively.

### Real-Time Header Interception
Every request to Gemini returns headers that reveal the current state of the API key's quota:
- `X-RateLimit-Limit-Requests`: Total requests allowed per minute.
- `X-RateLimit-Remaining-Requests`: Remaining requests in the current window.
- `X-RateLimit-Limit-Tokens`: Total tokens allowed per minute.
- `X-RateLimit-Remaining-Tokens`: Remaining tokens in the current window.

### Frontend Dashboard Widget
A "Quota Monitor" component in the Recruitment Dashboard:
1. **Model Capacity**: Displays the fixed limits (e.g., 1M context) of the selected model.
2. **Current pressure**: Shows a "Pressure Meter" (Green/Yellow/Red) based on the `Remaining` headers.
3. **Usage History**: A small local chart showing token consumption per session to help the user predict when they might hit daily limits.

---

## 3. Technical Implementation

## 3. Technical Implementation

### Backend: Usage Awareness Service (NestJS)
Instead of a separate service, we integrate quota awareness into the `AiService`. This ensures every generation captures the latest rate-limit data.

```typescript
@Injectable()
export class AiService {
  // Capture quota headers from the raw response
  async generateWithQuota(prompt: string) {
    const response = await this.model.generateContent(prompt);
    const quotaHeaders = response.response.headers; // Assuming interceptor captures these

    return {
      text: response.response.text(),
      usage: response.response.usageMetadata,
      quota: {
        remainingRequests: quotaHeaders.get('X-RateLimit-Remaining-Requests'),
        remainingTokens: quotaHeaders.get('X-RateLimit-Remaining-Tokens'),
      }
    };
  }

  // Admin utility to sync valid 3.1 models
  async syncModelCatalog(models: any[]) {
    const activeModels = models.filter(m => 
      m.name.includes('3.1') && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    // ... Upsert to Supabase
  }
}
```

### Frontend: Usage Visualizer (Next.js 16)
```tsx
const QuotaMeter = ({ usage }) => {
  const percentage = (usage.tokens / usage.limit) * 100;
  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm">
      <h4 className="text-sm font-semibold mb-2">{t('quota_visibility')}</h4>
      <Progress value={percentage} color={percentage > 80 ? 'red' : 'green'} />
      <p className="text-xs mt-1 text-muted-foreground">
        {usage.remaining} {t('tokens_left_this_minute')}
      </p>
    </div>
  );
};
```

---

## 4. Key Improvements
- **3.1 Primary Focus**: Transitions the entire system to Gemini 3.1, leveraging its superior reasoning and Arabic language models.
- **Quota Transparency**: Users see exactly what their API key allows, reducing friction and unexpected errors.
- **Dynamic Adaptability**: The UI intelligently suggests model swaps based on real-time key pressure.
- **Modern Infrastructure**: Uses standard NestJS patterns and native `fetch` for robust, fast performance.
- **Deprecated Cleanup**: Explicitly excludes Gemini 2.0 and earlier from the core workflow to maintain high analysis quality.
