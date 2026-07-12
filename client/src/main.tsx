import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App";
import "./index.css";
import { trackEvent } from "@/lib/analytics";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.2,
    ignoreErrors: [
      /Failed to construct 'WebSocket'.*localhost:undefined/,
    ],
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value || '';
      if (msg.includes('localhost:undefined') && msg.includes('WebSocket')) return null;
      const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
      if (frames.some((f: any) => f.filename?.includes('/@vite/client'))) return null;
      // Headless-browser bots (Playwright/Puppeteer scrapers) inject their own
      // scripts into the page; when those scripts crash it isn't our bug.
      if (frames.some((f: any) =>
        f.function?.includes('UtilityScript') ||
        f.function?.includes('addScriptContent') ||
        f.function?.includes('evaluateHandle')
      )) return null;
      return event;
    },
  });
}

function isVitePingNoise(msg: string): boolean {
  if (!msg) return false;
  if (msg.includes('localhost:undefined') && msg.includes('WebSocket')) return true;
  if (msg.includes("Failed to construct 'WebSocket'")) return true;
  return false;
}

window.addEventListener('error', (event) => {
  const message = event.message || '';
  if (isVitePingNoise(message)) return;
  if (event.filename?.includes('/@vite/')) return;
  trackEvent('js_error', {
    message: message.substring(0, 200),
    source: event.filename?.split('/').pop(),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason) || '';
  if (isVitePingNoise(message)) return;
  trackEvent('unhandled_promise_rejection', {
    message: message.substring(0, 200),
  });
});


createRoot(document.getElementById("root")!).render(<App />);
