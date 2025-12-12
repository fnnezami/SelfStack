// lib/env-server.ts
// Server-only vars (never import from "use client")
export const envServer = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  DATABASE_URL: process.env.DATABASE_URL || "",
  NODE_ENV: process.env.NODE_ENV || "development",
  N8N_HMAC_SECRET: process.env.N8N_HMAC_SECRET || "",

};

// Public vars are sometimes needed on server, too:
export const envPublicOnServer = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

// Helpers (don't crash import-time)
export function assertServerEnv<K extends keyof typeof envServer>(...keys: K[]) {
  const missing = keys.filter((k) => !envServer[k]);
  if (missing.length) {
    throw new Error(`Missing server env: ${missing.join(", ")}`);
  }
}
