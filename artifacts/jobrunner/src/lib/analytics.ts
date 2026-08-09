declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag("event", eventName, params);
}

export function trackPageView(pagePath: string, pageTitle?: string) {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_title: pageTitle,
  });
}
