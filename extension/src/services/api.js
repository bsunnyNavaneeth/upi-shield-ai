const DEFAULT_API = 'https://msxkvurukpyljcwgttru.supabase.co/functions/v1/analyze-url';

export async function getApiUrl() {
  const { apiUrl } = await chrome.storage.local.get({ apiUrl: DEFAULT_API });
  return apiUrl || DEFAULT_API;
}

export async function analyzeUrl(rawUrl) {
  const endpoint = await getApiUrl();
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web links can be checked.');
  const safeUrl = `${url.origin}${url.pathname}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: safeUrl }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('The safety service is unavailable. Try again later.');
  const data = await response.json();
  if (!Number.isFinite(data.risk_score) || data.risk_score < 0 || data.risk_score > 100) throw new Error('The safety service returned an invalid result.');
  return { ...data, risk_level: data.risk_level ?? (data.risk_score <= 30 ? 'LOW' : data.risk_score <= 60 ? 'MEDIUM' : data.risk_score <= 80 ? 'HIGH' : 'CRITICAL') };
}

export async function saveAnalysis(item) {
  const { recentAnalyses = [] } = await chrome.storage.local.get('recentAnalyses');
  await chrome.storage.local.set({ recentAnalyses: [item, ...recentAnalyses].slice(0, 10) });
}
