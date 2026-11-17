import { analyzeUrl, saveAnalysis } from '../services/api.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'upi-shield-check-link', title: 'Check link with UPI Shield AI', contexts: ['link'] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'upi-shield-check-link' || !info.linkUrl) return;
  try {
    const result = await analyzeUrl(info.linkUrl);
    const item = { url: info.linkUrl, risk_score: result.risk_score, risk_level: result.risk_level, summary: result.summary ?? 'Review this link carefully.', created_at: new Date().toISOString() };
    await saveAnalysis(item);
    await chrome.storage.local.set({ lastAnalysis: item });
  } catch (error) {
    await chrome.storage.local.set({ lastAnalysisError: error instanceof Error ? error.message : 'Unable to check this link.' });
  }
});
