/// <reference types="vite/client" />
// Cloudflare bindings and secrets available to server code via `cloudflare:workers`.
// Secrets are set with `wrangler secret put NAME` in production or `.dev.vars` locally.
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AUTH_SECRET?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    APPLE_CLIENT_ID?: string;
    APPLE_TEAM_ID?: string;
    APPLE_KEY_ID?: string;
    APPLE_PRIVATE_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    ASSISTANT_MODEL?: string;
  }
}
