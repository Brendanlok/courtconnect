// Privacy-friendly visitor/signup analytics — no-op until Lok supplies a GA4
// measurement ID (create a free GA4 property, add NEXT_PUBLIC_GA_MEASUREMENT_ID
// as a GitHub Actions repo secret). Until then this module does nothing and no
// script is ever loaded.
// ponytail: GA4 over a self-hosted option (Umami/Plausible) — free, self-serve
// account creation, zero infra. Swap later if privacy requirements change.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
