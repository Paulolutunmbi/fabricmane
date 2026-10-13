# Fabricmane — Task List

Work in order. Tick each box when done and lint + build pass. Stop at each STOP and wait for approval.
Deadline: Friday, October 16, 2026. Priority if time runs short: secure catalogue + core CRUD + WhatsApp enquiry > AI extras.

## Phase 0 — Foundation
- [ ] Inspect existing project and the real image folder; report findings (do not move files)
- [ ] Add dependencies, `.env.example`, update `.gitignore` (assets-local, fabric-import-staging, .env*, import-report.json)
- [ ] `lib/db.ts`, Fabric model, counter, zod schemas, types
- [ ] Design tokens in Tailwind config + fonts + base layout
- STOP: review

## Phase 1 — Image import
- [ ] `scripts/import-fabrics.ts`: recursive scan, hashing, duplicate skip, Cloudinary upload, DB record after success, resume, report, `--dry-run`, `--limit`
- [ ] Run `--dry-run`, then `--limit 10`
- STOP: I verify the 10 records. Only then run the full import.

## Phase 2 — Storefront
- [ ] Header, footer, WhatsApp link helper
- [ ] Home page (featured, new arrivals, categories)
- [ ] Catalogue with search, category filter, pagination
- [ ] `/f/[fabricId]` page with Enquire on WhatsApp + copy link
- [ ] Loading/empty/error states, responsive check
- STOP: review

## Phase 3 — Admin
- [ ] Owner login/logout, middleware, seed script
- [ ] Overview, fabrics list/search, create/edit/delete (with confirm)
- [ ] Image upload (signed), replace, remove
- [ ] Publish/unpublish, featured, new arrival
- [ ] Needs Review screen with bulk category/color assignment
- STOP: review

## Phase 4 — AI assistant
- [ ] Groq provider wrapper (model from env)
- [ ] Read tools: search, get, list categories, count
- [ ] Write tools via pending actions + confirm endpoint with revalidation
- [ ] Chat UI with preview cards
- [ ] Rate limiting, error handling, test ambiguity and invalid requests
- STOP: review

## Phase 5 — Delivery
- [ ] Run acceptance tests from PRD section 13
- [ ] Security headers, env audit, no secrets in repo
- [ ] Deploy to Vercel, set env vars, test production
- [ ] Write README (setup, env vars, importer usage)
