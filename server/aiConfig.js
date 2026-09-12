const DEFAULT_API_URL = 'https://api.apiyi.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.6-luna';

export function isAiConfigured(env = process.env) {
  return Boolean(String(env.APIYI_LLM_API_KEY || '').trim());
}

export function getAiConfig(env = process.env) {
  const apiKey = String(env.APIYI_LLM_API_KEY || '').trim();
  if (!apiKey) throw new Error('APIYI_LLM_API_KEY is not configured');

  const configuredUrl = String(env.APIYI_LLM_API_URL || '').trim() || DEFAULT_API_URL;
  const baseUrl = configuredUrl.replace(/\/+$/, '');
  const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const model = String(env.APIYI_LLM_MODEL || '').trim() || DEFAULT_MODEL;
  return { apiKey, apiUrl, model };
}
