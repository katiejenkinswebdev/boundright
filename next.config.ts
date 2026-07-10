import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Next.js dev mode (HMR, React Refresh) requires eval; production must not.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline runtime + styles; Stripe redirects happen top-level.
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: http://127.0.0.1:55321 https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' http://127.0.0.1:55321 https://*.supabase.co https://*.ingest.sentry.io",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Logo uploads go through a server action; PDFs never do (signed URLs).
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

// Sentry wrapping is a no-op at runtime without SENTRY_DSN.
export default withSentryConfig(nextConfig, { silent: true });
