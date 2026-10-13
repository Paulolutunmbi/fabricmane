# Fabricmane — Coding Rules (for Antigravity)

## Always
1. Read `prd.md`, `architecture.md`, `design.md`, `task.md`, `memory.md` before coding. Work through `task.md` in order, one phase at a time.
2. Use the existing Next.js project. Do not scaffold a new one.
3. TypeScript strict. No `any` unless justified in a comment.
4. Validate every external input with zod at the server boundary.
5. All DB, Cloudinary and Groq calls happen server-side only.
6. Never invent business data: no fake prices, products, reviews, addresses, delivery claims or contact details. Use "Enquire for Price" when price is null. Placeholder content must be obviously marked.
7. After each task: run `npm run lint` and `npm run build`, fix errors, then update `memory.md` and tick the task in `task.md`.
8. Prefer small reusable components. No duplicated logic.
9. Install only necessary dependencies. Tell me before adding anything beyond: mongoose, zod, bcryptjs, jose, cloudinary, groq-sdk, and image-scan helpers.

## Never
- No payments, checkout, cart, customer accounts, availability toggle, or units of sale.
- No secrets in code, logs, git, or `NEXT_PUBLIC_` variables.
- No hardcoded product arrays in the storefront. Data comes from MongoDB.
- No direct AI writes to the database. Writes go through pending actions + owner confirmation + server revalidation.
- Do not commit `assets-local/`, `.env*` (except `.env.example`), or `import-report.json`.
- Do not run the importer on the full image set until a `--dry-run` and a `--limit 10` test both pass and I approve.
- Do not delete files or data without asking.
- Do not add features outside the PRD. Put ideas in `memory.md` under "Ideas".

## Security checklist (apply to every route)
- Session check in the handler, not just middleware.
- Public routes return only `published` fabrics and only customer-safe fields.
- Safe error messages. Log details server-side only.
- Rate limit login and assistant.
- Security headers in `next.config`.
- Escape/encode anything placed in a WhatsApp URL.

## UI rules
- Follow `design.md` exactly. Mobile-first. Semantic HTML, labels, alt text, visible focus states.
- Every data view has loading, empty, and error states.
- Use `next/image` with Cloudinary transformations for sized images.

## Git
- Small commits, message format `feat|fix|chore: summary`.
