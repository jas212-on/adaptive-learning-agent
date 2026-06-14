# Security

## Authentication

All user-scoped API endpoints require a valid Supabase JWT in the `Authorization: Bearer` header. The backend (`backend/auth.py`) verifies the token:

- If the token uses an asymmetric algorithm (**ES256** or **RS256**), it automatically queries your Supabase project's **JWKS (JSON Web Key Set)** endpoint to retrieve public signing keys and verify the token signature securely.
- If the token uses a symmetric algorithm (**HS256**), the JWT is verified using `SUPABASE_JWT_SECRET` (if configured) — invalid signatures and expired tokens are rejected with 401.
- If no verification keys are configured or reachable (development fallback), the token is decoded without signature verification. **Never deploy to production without signature verification enabled.**

## Row-Level Security (RLS)

Every table in Supabase has RLS enabled. Policies enforce that users can only read and write their own rows (`auth.uid() = user_id`). The service-role key bypasses RLS and is used only on the backend — it is never exposed to the browser.

## Privacy and OCR data

The screen-capture agent runs locally. Raw OCR text stays on disk (`backend/output.json`) and is never stored in Supabase. Before any captured text is processed by Gemini:

1. A `bart-large-mnli` zero-shot classifier scores the text across categories (educational, personal, credential, etc.).
2. Text that scores above threshold for non-educational categories is discarded and never sent to any external API.

This prevents passwords, private messages, and financial information visible on screen from leaking to Gemini or SerpAPI.

## Sensitive keys

| Key | Where | Notes |
|-----|-------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | `backend/.env` only | Never in frontend; bypasses RLS |
| `SUPABASE_JWT_SECRET` | `backend/.env` only | Used to verify user JWTs |
| `GOOGLE_API_KEY` | `backend/.env` only | Gemini AI access |
| `SERPAPI_API_KEY` | `backend/.env` only | Web resource search |
| `VITE_SUPABASE_ANON_KEY` | `frontend/.env` + `backend/.env` | Safe to expose; RLS-restricted |

The anon key is intentionally public-facing (Supabase's design). All other keys must be kept out of version control. The `.gitignore` excludes both `.env` files.

## CORS

In development, CORS is open to `http://localhost:5173`. For production, set `CORS_ORIGINS` in `backend/.env` to your exact domain(s). The startup validator (`config.py`) warns if localhost origins remain in production mode (`ENV=production`).

## Rate limiting

AI endpoints are rate-limited to 10 requests/minute per IP by default (`RATE_LIMIT_AI`). Data endpoints are limited to 60/minute (`RATE_LIMIT_DATA`). Adjust these in `backend/.env`.

## Responsible disclosure

If you find a security vulnerability, please report it by opening a **private** GitHub Security Advisory on the repository rather than a public issue.
