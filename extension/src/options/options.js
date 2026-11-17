import { getApiUrl } from '../services/api.js';

const apiInput = document.querySelector('#apiUrl');
const dashboardInput = document.querySelector('#dashboardUrl');
const status = document.querySelector('#status');
const defaults = await chrome.storage.local.get({ dashboardUrl: 'http://localhost:5173' });
apiInput.value = await getApiUrl();
dashboardInput.value = defaults.dashboardUrl;

document.querySelector('#save').addEventListener('click', async () => {
  try {
    const api = new URL(apiInput.value);
    const dashboard = new URL(dashboardInput.value);
    if (api.protocol !== 'https:' || dashboard.protocol !== 'https:' && dashboard.hostname !== 'localhost') throw new Error('Use HTTPS URLs (localhost is allowed for the dashboard).');
    await chrome.storage.local.set({ apiUrl: api.href, dashboardUrl: dashboard.href });
    status.textContent = 'Settings saved on this device.';
  } catch (error) { status.textContent = error instanceof Error ? error.message : 'Please check the URLs.'; }
});
