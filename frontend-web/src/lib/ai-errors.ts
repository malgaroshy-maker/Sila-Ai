export interface AiError {
  message: string;
  code?: string;
  model?: string;
  retryAfter?: string;
}

/**
 * Parses an error from the backend (NestJS HttpException) and returns a localized string.
 * @param error The error object (from axios/fetch response)
 * @param t The translation object (Index)
 */
export const parseAiError = (error: any, t: any): string => {
  // NestJS with Axios usually puts the response in error.response.data
  const data = error?.response?.data || error;
  
  if (data?.code === 'AI_QUOTA_EXCEEDED') {
    const modelName = data.model?.replace('models/', '') || '';
    const resetTime = data.retryAfter || '';
    
    // Check for specific details key first
    if (t.error_quota_exceeded_details) {
      return t.error_quota_exceeded_details
        .replace('{model}', modelName)
        .replace('{reset}', resetTime);
    }
    return t.error_quota_exceeded || 'Quota exceeded for AI model.';
  }

  if (data?.code === 'AI_ERROR') {
    return `${t.error_ai_failed || 'AI Error'}: ${data.message || ''}`;
  }

  // Handle generic HTTP errors
  if (error?.response?.status === 402) {
    return t.error_payment_required || 'Payment required or API key inactive.';
  }

  // Fallback to the message if it's a known string or use the unknown key
  const message = data?.message || error?.message;
  if (!message) return t.unknown || 'An unexpected error occurred.';
  
  return message;
};
