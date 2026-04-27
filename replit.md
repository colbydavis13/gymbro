# Workspace — Gym Bro

## Overview

pnpm workspace monorepo for **Gym Bro**, a mobile-first gym habit tracker built for Colby Davis's class assignment. Single-user, no auth.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 22 (Azure target)
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS 4, Wouter routing, Radix UI, Sonner toasts
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: Supabase JS client (`@supabase/supabase-js`) — no Drizzle
- **Validation**: Zod, OpenAPI spec → Orval codegen
- **Build**: esbuild (ESM bundle) for API; Vite for frontend
- **Notifications**: Web Push (VAPID), node-cron scheduler, Resend email
- **Analytics**: Google Analytics 4 via `VITE_GA_MEASUREMENT_ID`

## Deployment

Both services deploy to **Azure App Service** (Node 22, as code):
- **Frontend**: `artifacts/gym-bro` → `server.mjs` serves built Vite output
- **API**: `artifacts/api-server` → `node --enable-source-maps ./dist/index.mjs`
- CI/CD: `.github/workflows/azure-deploy.yml` (triggers on push to `main`)
- See `DEPLOYMENT.md` for step-by-step Azure setup guide

## Key Environment Variables

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — database
- `RESEND_API_KEY`, `TARGET_EMAIL` — daily email reminders
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — push notifications
- `ALLOWED_ORIGIN` — CORS origin (frontend URL in production)
- `VITE_GA_MEASUREMENT_ID` — Google Analytics
- `VITE_API_BASE_URL` — API URL for production frontend build

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/gym-bro run dev` — run frontend locally

## Artifacts

- `artifacts/gym-bro` — React frontend (port from `PORT` env var)
- `artifacts/api-server` — Express API (port from `PORT` env var)
- `lib/db` — Supabase client export
- `lib/api-client-react` — Orval-generated React Query hooks
- `lib/api-spec` — OpenAPI spec + Orval codegen config
- `lib/api-zod` — Zod schemas from spec
