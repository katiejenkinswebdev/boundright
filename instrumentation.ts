import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Privacy floor: no document content, extracted values, or PII in events.
    sendDefaultPii: false,
    beforeSend(event) {
      // Belt and braces: strip request bodies entirely.
      if (event.request) delete event.request.data;
      return event;
    },
  });
}

export const onRequestError = Sentry.captureRequestError;
