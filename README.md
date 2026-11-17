# UPI Shield AI

A privacy-first scam-awareness dashboard with explicit message, link, and screenshot checks, Supabase account/history support, and a Manifest V3 browser extension source.

## Current implementation

- Responsive dark cybersecurity dashboard with risk results and safety recommendations.
- Sign-up/sign-in through Supabase Auth and private per-user analysis history.
- Database tables `profiles` and `analyses`, with row-level security and an automatic profile-on-signup trigger.
- Text and URL checks run a small local pattern-based preview when no analysis API is configured. This is **not an ML model** and is not a finding of fraud.
- Set `VITE_API_BASE_URL` to a trusted FastAPI-compatible service to enable server-side analysis. The app submits `POST {VITE_API_BASE_URL}/api/urls/analyze` as multipart fields `text` and optional `file`. Expected JSON: `risk_score` (0–100), optional `risk_level`, `summary`, and `indicators` (string array).
- Image uploads are validated to image MIME types and 5 MB. They are not analyzed locally; configure the server API to process them.
- Chrome extension source under `extension/` checks only the active tab after a button press, or a selected link via its context menu. The extension does not inspect page contents or payment forms.

## Supabase setup

The client uses the project's public publishable key in `src/integrations/supabase/client.ts`. Never put a service-role key in the browser. The `profiles` and `analyses` tables are protected by owner-only RLS. Configure the Supabase Auth email confirmation redirect allowlist to include the app's `/auth/callback` URL for local and deployed origins.

## Extension

Load the `extension/` directory as an unpacked extension in Chrome's extension management page. Under extension settings, set the API endpoint and dashboard URL. The default endpoint is a placeholder Supabase Edge Function path and must be replaced with a deployed URL-analysis service. If using a different API host, add that exact HTTPS origin to `host_permissions` in `extension/manifest.json` before loading the extension. No API secret belongs in extension settings.

Permissions: `activeTab` accesses the current tab URL only after user action; `storage` keeps settings and up to 10 URL checks on this device; `contextMenus` adds the user-triggered right-click action; the host permission permits requests only to the configured Supabase project host by default.

## Not yet part of this implementation

There is no FastAPI service, trained ML model, OCR/image interpretation, threat-intelligence integration, rate limiting, cloud deployment configuration, admin module, scam reporting workflow, or verified real-world performance data in this repository yet. The UI and extension API clients are prepared to connect to a backend, but do not claim to be an AI detector without one. A low score is never a guarantee of safety.
