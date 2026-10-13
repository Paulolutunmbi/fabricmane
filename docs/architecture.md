# Fabricmane — Architecture

Read `prd.md` first. This file defines HOW to build it. Do not add features beyond the PRD.

## Stack
- Next.js (App Router) + React + TypeScript + Tailwind CSS. Use the EXISTING project; do not create a second app.
- MongoDB Atlas via Mongoose. Cloudinary for images. Groq for AI (`GROQ_MODEL`, default `openai/gpt-oss-120b`, switchable to `openai/gpt-oss-20b`).
- Deploy: Vercel.
- NO payments, NO checkout, NO cart, NO availability status, NO units of sale. Enquiries go to WhatsApp only.

## Folder structure
```
src/
  app/
    (public)/
      page.tsx                 # Home
      fabrics/page.tsx         # Catalogue: search + category filter
      f/[fabricId]/page.tsx    # Permanent fabric page, e.g. /f/FB-000123
      contact/page.tsx
    admin/
      login/page.tsx
      (protected)/
        page.tsx               # Overview
        fabrics/page.tsx       # List/search/edit
        fabrics/new/page.tsx
        review/page.tsx        # Uncategorized / Needs Review
        assistant/page.tsx     # AI chat
    api/
      auth/login|logout/route.ts
      fabrics/route.ts, fabrics/[id]/route.ts
      upload/sign/route.ts
      assistant/route.ts       # chat + tool loop
      assistant/confirm/route.ts
  components/ (ui/, storefront/, admin/, assistant/)
  lib/
    db.ts                      # cached Mongoose connection
    models/Fabric.ts
    auth.ts                    # session helpers
    cloudinary.ts
    whatsapp.ts                # buildEnquiryLink(fabric)
    validation.ts              # zod schemas
    ai/
      provider.ts              # Groq wrapper (replaceable)
      tools.ts                 # tool definitions + executors
      pending-actions.ts       # confirmation store
  types/
scripts/
  import-fabrics.ts            # bulk importer
  seed-admin.ts
```

## Data model: Fabric
| Field | Notes |
|---|---|
| fabricId | Unique, permanent, e.g. `FB-000123`. Generated from an atomic counter. Never reused, never changed. |
| name | String, can be empty while status is `needs_review` |
| description | Optional |
| category | Optional while `needs_review` |
| colors | String[] |
| price | Number or null. Null displays "Enquire for Price". Never invented. |
| currency | `NGN` |
| images | [{ url, publicId, width, height, originalFilename, originalPath, contentHash }] |
| featured, newArrival | Boolean |
| status | `needs_review` \| `draft` \| `published` |
| createdAt, updatedAt | Automatic |

Indexes: `fabricId` (unique), `images.contentHash` (duplicate detection), text index on name/description/category/colors, `status`+`category`.
Public queries ONLY return `status: published`, and only customer-safe fields.

## Counter
A `counters` collection with `findOneAndUpdate({ $inc: { seq: 1 } })` generates `FB-` + zero-padded 6 digits.

## Authentication
- Single owner account. No public registration. Credentials from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`) or a seeded user.
- Password hashed with bcrypt. Session in an httpOnly, secure, sameSite=lax signed cookie (JWT via `jose`).
- Middleware protects `/admin/*` (except login) and every write API. Each route handler ALSO checks the session. Never rely on middleware alone.
- Rate-limit login and `/api/assistant`.

## Image pipeline
1. `scripts/import-fabrics.ts` recursively scans `FABRIC_IMPORT_ROOT` (inspect the real folder; do not assume the name) for jpg/jpeg/png/webp/avif.
2. For each file: compute SHA-256 hash, skip if already in DB or in the import log; upload to Cloudinary (folder `fabricmane/`); only after success create a Fabric with `status: needs_review`; log failures; resume after interruption; process in small batches; support `--dry-run` and `--limit N`.
3. Write `import-report.json` (gitignored) with relative paths, new IDs, skipped duplicates, failures.
4. Admin uploads use signed Cloudinary params from `/api/upload/sign`. Secrets never reach the browser.
5. Deleting a fabric removes its Cloudinary asset only if no other record references the `publicId`.

## WhatsApp enquiry
`buildEnquiryLink(fabric)` returns `https://wa.me/${WHATSAPP_NUMBER}?text=<encoded>` with message:
```
Hi Fabricmane, I'm interested in fabric FB-000123.
Please let me know the price and availability.
https://<SITE_URL>/f/FB-000123
```
`WHATSAPP_NUMBER` is international format with no `+`, from env. Never hardcode it.

## AI assistant
- Flow: owner message -> server `/api/assistant` -> Groq with tool definitions -> model requests a tool -> server validates and executes.
- Read tools (execute immediately): `search_fabrics`, `get_fabric`, `list_categories`, `count_fabrics`.
- Write tools (NEVER execute directly): `propose_update_fabric`, `propose_create_fabric`, `propose_delete_fabric`, `propose_publish`. They create a pending action `{ id, type, payload, preview, expiresAt, adminId }` and return a preview.
- The owner clicks Confirm in the UI -> `/api/assistant/confirm` re-validates the payload with zod, re-checks the session, re-loads the target, then writes. The model cannot confirm.
- Ambiguous match (more than one fabric) -> return candidates and ask. Never guess.
- Tool results carry real DB values. The system prompt forbids inventing prices, IDs, URLs, or success.
- Provider code lives in `lib/ai/provider.ts` so Groq can be swapped.

## Environment variables (`.env.example`, no real values)
```
MONGODB_URI=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
SESSION_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
WHATSAPP_NUMBER=
NEXT_PUBLIC_SITE_URL=
FABRIC_IMPORT_ROOT=
```
Only `NEXT_PUBLIC_SITE_URL` may be public.
