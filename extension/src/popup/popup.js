import { analyzeUrl, saveAnalysis } from '../services/api.js';

const domainNode = document.querySelector('#domain');
const scanButton = document.querySelector('#scan');
const resultNode = document.querySelector('#result');
const historyNode = document.querySelector('#history');
const riskClass = level => `risk-${String(level).toLowerCase()}`;

async function renderHistory() {
  const { recentAnalyses = [] } = await chrome.storage.local.get('recentAnalyses');
  historyNode.replaceChildren();
  if (!recentAnalyses.length) {
    const empty = document.createElement('li'); empty.className = 'empty'; empty.textContent = 'Your checks will appear here.'; historyNode.append(empty); return;
  }
  for (const item of recentAnalyses.slice(0, 4)) {
    const row = document.createElement('li');
    const label = document.createElement('span'); label.textContent = new URL(item.url).hostname;
    const risk = document.createElement('strong'); risk.className = riskClass(item.risk_level); risk.textContent = `${item.risk_level} · ${item.risk_score}`;
    row.append(label, risk); historyNode.append(row);
  }
}

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
let activeUrl;
try { activeUrl = new URL(tab?.url); domainNode.textContent = activeUrl.hostname; }
catch { domainNode.textContent = 'This page cannot be checked'; scanButton.disabled = true; }

scanButton.addEventListener('click', async () => {
  if (!activeUrl) return;
  scanButton.disabled = true; scanButton.textContent = 'Checking link…';
  resultNode.classList.add('hidden');
  try {
    const data = await analyzeUrl(activeUrl.href);
    const item = { url: activeUrl.href, risk_score: data.risk_score, risk_level: data.risk_level, summary: data.summary ?? 'Review the domain and request independently.', created_at: new Date().toISOString() };
    await saveAnalysis(item);
    const title = document.createElement('strong'); title.className = riskClass(item.risk_level); title.textContent = `${item.risk_level} RISK · ${item.risk_score}/100`;
    const summary = document.createElement('p'); summary.textContent = item.summary;
    const disclaimer = document.createElement('small'); disclaimer.textContent = 'An estimate only — HTTPS does not guarantee safety.';
    resultNode.replaceChildren(title, summary, disclaimer); resultNode.classList.remove('hidden');
    await chrome.storage.local.remove('lastAnalysisError');
    await renderHistory();
  } catch (error) {
    const message = document.createElement('p'); message.textContent = error instanceof Error ? error.message : 'Could not check this website.';
    resultNode.replaceChildren(message); resultNode.classList.remove('hidden');
  } finally { scanButton.disabled = false; scanButton.textContent = '⌕  Scan current website'; }
});

document.querySelector('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
document.querySelector('#clear').addEventListener('click', async () => { await chrome.storage.local.remove('recentAnalyses'); await renderHistory(); });
document.querySelector('#dashboard').addEventListener('click', async event => { event.preventDefault(); const { dashboardUrl } = await chrome.storage.local.get({ dashboardUrl: 'http://localhost:5173' }); chrome.tabs.create({ url: dashboardUrl }); });
await renderHistory();
