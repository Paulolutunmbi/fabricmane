# Fabricmane Product Requirements Document (PRD)

**Project:** Fabricmane Website and AI-Assisted Admin  
**Document status:** Updated requirements for implementation  
**Target delivery date:** Friday, 16 October 2026  
**Primary stack:** Next.js, React, TypeScript, Tailwind CSS, MongoDB Atlas, Mongoose, Cloudinary, Groq  
**Deployment target:** Vercel for the web application (subject to environment and deployment checks)

---

## 1. Product overview

Fabricmane is a fabric business that needs a professional website where customers can browse fabric images, open a dedicated page for a particular fabric, and contact the business through WhatsApp to enquire about that exact item.

The website will also include a secure, owner-only admin dashboard. The owner must be able to manage the fabric catalogue manually and use an AI assistant powered by Groq to help perform supported admin tasks.

The project is being built from an existing Next.js project created with `create-next-app`. MongoDB Atlas is already set up, and the Groq SDK has been installed. The implementation must inspect the existing repository and preserve working configuration rather than blindly replacing files.

## 2. Goals

1. Present Fabricmane's brand, logo, and fabric collection in a polished, mobile-friendly website.
2. Make it easy for customers to browse fabrics by category and open a specific fabric.
3. Give every catalogue item a stable, unique ID and a permanent public URL.
4. Route enquiries to Fabricmane's WhatsApp with the relevant fabric ID and URL prefilled in the message.
5. Allow the owner to add, edit, categorize, describe, and remove catalogue items through a protected dashboard.
6. Provide a bulk importer that can process a large local image collection, including images nested in subfolders.
7. Store image files in Cloudinary and their metadata/references in MongoDB Atlas.
8. Offer an AI admin assistant that invokes only approved, validated server-side operations.
9. Keep credentials, admin operations, and upload signing securely on the server.

## 3. Out of scope

The first release will **not** include:

- Online checkout or shopping cart.
- Payment gateway or online payments.
- Customer accounts or customer sign-in.
- Available/unavailable status controls.
- Units of sale (such as yards, metres, pieces, or sets).
- Stock/quantity management unless explicitly approved in a later revision.
- AI access to unrestricted database queries or arbitrary server commands.
- Public upload access for visitors.

Customers browse the catalogue and contact Fabricmane through WhatsApp. The site should not imply that a fabric can be purchased or paid for directly on the website.

## 4. Users and permissions

### 4.1 Public visitor

A visitor can:
- View the home page and brand information.
- Browse fabric categories and the catalogue.
- Open a dedicated fabric details page using its permanent URL.
- View the fabric image, item ID, and known details.
- Start a WhatsApp enquiry for a particular item.
- Copy or share the permanent item URL.

A visitor cannot:
- Access the admin dashboard.
- Edit or delete products.
- Upload images.
- Access private environment variables or administrative API operations.

### 4.2 Fabricmane owner/admin

The single authorized owner/admin can:
- Sign in to the protected dashboard.
- Create, edit, categorize, and delete catalogue items.
- Upload new images or import a batch of local images.
- Review images that have not yet been categorized.
- Edit image descriptions and color/category information.
- Preview a public item page and its WhatsApp enquiry link.
- Use the AI assistant for supported catalogue-management tasks.
- Review bulk-import results, errors, and skipped/duplicate files.

No public customer account is required. Admin authentication must be implemented securely; do not rely on hiding dashboard links as a security measure.

## 5. Public website requirements

### 5.1 Brand and layout

- Use Fabricmane's supplied logo and brand assets.
- Build a polished, trustworthy, responsive fabric-business website.
- Design mobile-first and verify desktop, tablet, and mobile layouts.
- Use actual supplied product imagery rather than generic placeholders once assets are identified.
- Keep navigation clear and the catalogue easy to explore.
- Do not invent brand claims, product details, prices, or fabric properties.

### 5.2 Home page

The home page should include:
- Fabricmane branding and a clear introduction.
- A prominent path into the fabric catalogue.
- Selected fabric/category imagery.
- A clear WhatsApp contact/enquiry call to action.
- Responsive navigation and footer information based on details supplied by the owner.

### 5.3 Fabric catalogue

- Display fabric items in a responsive grid.
- Support browsing by admin-defined categories.
- Provide a detail page for every published catalogue item.
- Each item card should open the item's own page.
- Show only information that has been provided or verified.
- Do not display an availability status or unit of sale.
- If search or color filtering is implemented, use only actual recorded metadata; do not claim that image color recognition is guaranteed.

### 5.4 Fabric detail page and permanent URL

Each published item must have:
- A stable, unique public item ID, for example `FB-000123` (the exact format can be implemented differently).
- A permanent, shareable URL, for example `/f/FB-000123`.
- The selected image.
- Its item ID.
- Known category, color, and description, when supplied.
- A WhatsApp enquiry button.

The item ID must be unique and must not change if the item's title, category, color, or image filename changes. The public URL must resolve directly to the correct item. If an item is deleted or unpublished, the application must handle its URL gracefully rather than showing an unhandled error.

### 5.5 WhatsApp enquiries

- There is no on-site checkout or payment.
- The main product enquiry action opens WhatsApp using a configurable Fabricmane business number.
- The prefilled message should identify the fabric ID and include its permanent public URL.
- Example message:

  > Hi Fabricmane, I'm interested in fabric FB-000123. Please share more details about this fabric. https://fabricmane.com/f/FB-000123

- URL-encode the prefilled message correctly.
- Store the WhatsApp number in environment/configuration, not in multiple hardcoded components.
- Use the actual production domain once it is confirmed.
- If the WhatsApp number has not been supplied, provide a clear configuration placeholder and document that it must be set before launch.
- The customer must be able to open the link on mobile and desktop where WhatsApp is available.

## 6. Admin dashboard requirements

The dashboard must be protected by admin authentication and include:

- Catalogue overview and item list.
- Create, edit, and delete actions.
- Image preview.
- Category, color, and description fields.
- Search/filter by known item metadata.
- Image-import status and results.
- An uncategorized/needs-review queue.
- A way to preview the public item page and copy its URL.
- A way to test the WhatsApp enquiry link.

Do not include available/unavailable toggles, unit-of-sale fields, cart, checkout, or payment settings.

Deleting a catalogue record and deleting its Cloudinary image should be handled deliberately. Confirm destructive actions, avoid accidental bulk deletion, and do not leave records in a partially corrupted state. Document whether deletion archives an item or removes it permanently.

## 7. Image asset and bulk-import requirements

### 7.1 Local asset collection

The owner has already created a local folder containing supplied fabric images and logos. Some image files are nested inside subfolders. The implementation must use the actual folder path provided in the repository/environment rather than assuming a path that may not exist.

Keep original source images outside version control. Recommended approach:
- Keep source images in the existing local assets folder (for example, `assets-local/`).
- Add the real source folder to `.gitignore`.
- Commit only the application code, import scripts, documentation, and approved website assets such as the final logo/favicon.
- Do not commit large collections of original fabric photos to GitHub.
- Do not overwrite or reorganize the owner's originals during import.

A separate `fabric-import-staging/` folder is optional. It is only needed if the implementation creates a distinct temporary workspace. If used, ignore `/fabric-import-staging/` in Git. Do not create it merely as an assumed replacement for the owner's existing assets folder.

### 7.2 Recursive file discovery

The importer must:
- Scan the configured root folder recursively through all nested subfolders.
- Discover image files in the root folder as well as in any depth of subfolders.
- Support common web-friendly image types, at minimum JPEG/JPG, PNG, and WebP; support GIF, AVIF, TIFF, or other formats only if the chosen processing/upload path supports them.
- Ignore directories, hidden/system files, unsupported file types, and temporary files safely.
- Preserve the original relative path and filename in the import report and, where useful, in metadata.
- Avoid requiring the owner to manually flatten folders or rename every image.
- Handle filenames containing spaces and non-ASCII characters.
- Avoid following symlinks outside the configured import root.
- Report the number of discovered images and unsupported/skipped files before or during import.

### 7.3 Safe import process

Implement a local/server-side import script or protected admin import workflow that:
1. Reads files recursively from the configured local directory.
2. Validates file extensions and actual image content where feasible.
3. Enforces reasonable file-size limits and reports oversized files.
4. Generates a stable unique catalogue ID for each newly created item.
5. Uploads each image to Cloudinary using server-side credentials.
6. Saves the Cloudinary public ID, secure URL, original filename/relative path, item ID, and metadata in MongoDB.
7. Records success/failure per file and provides a summary.
8. Can resume after interruption without duplicating already imported files.
9. Detects duplicates using a reliable fingerprint (such as a SHA-256 checksum) and/or stored source metadata. Do not rely on filename alone, because different files may share a name.
10. Does not create a published item record when its Cloudinary upload fails.
11. Handles a MongoDB failure after a successful Cloudinary upload with retry/cleanup or a clearly reported recovery state.
12. Processes files in controlled batches with bounded concurrency, retry/backoff for transient errors, and rate-limit awareness.
13. Never deletes or modifies the local originals.
14. Supports a dry-run mode that lists discovered files and likely actions without uploading them.
15. Does not silently mark uncertain categories or colors as facts.

The owner should be able to test the importer on a small sample batch before importing the full collection.

### 7.4 Unsorted images and review

The owner does not know how all supplied fabric photos should be separated yet. Therefore:
- Do not require all images to be manually categorized before import.
- Imported images with unknown category/color should be marked as needing review, not marked available/unavailable.
- Provide a dashboard queue for uncategorized images.
- Allow the owner to select one or more images and assign a category or edit metadata.
- AI may suggest a category, color, or description only if the implemented model/capability supports it. Suggestions must be clearly identified as suggestions and reviewed by the owner before publication.
- Do not assume a model that accepts text prompts also accepts image inputs. Do not send image content to a text-only model.
- Preserve the image ID and URL when metadata is edited.

### 7.5 Cloudinary and MongoDB responsibilities

- Cloudinary stores image binaries and serves optimized images.
- MongoDB Atlas stores catalogue records and metadata, not raw image binaries.
- Save Cloudinary identifiers and secure URLs in the database.
- Use Cloudinary's secure URL and responsive/image optimization capabilities where practical.
- Keep Cloudinary API secret and any signed-upload logic on the server.
- Do not expose MongoDB credentials, Groq API keys, or Cloudinary secrets to client-side code.
- Use a consistent, documented Cloudinary folder/naming strategy, such as `fabricmane/catalogue/{itemId}`.
- Make the importer idempotent and make import outcomes auditable.

### 7.6 Git and local files

- Ensure `.gitignore` excludes the actual local source image directory, `.env.local`, `.env` files, import staging folders, generated output, and dependencies.
- Keep `.env.example` with placeholder variable names only.
- Check `git status` and staged files before committing; do not stage local images or secrets.
- If original assets have already been committed, `.gitignore` alone will not remove them from Git history; inspect and resolve before pushing.
- Approved small branding assets that are required by the website may live in `public/` and be committed.

## 8. AI admin assistant (Groq)

### 8.1 Purpose

The AI assistant helps the owner perform supported catalogue tasks using natural language. Examples:
- “Create a category called Ankara.”
- “Change the description of fabric FB-000123.”
- “Set the color of this item to burgundy and gold.”
- “Show me the fabrics that still need categorization.”
- “Help me organize these selected images into categories.”
- “Update the description of this fabric to the text I provide.”

The AI must not invent product details, claim it uploaded or changed something unless the backend confirms success, or execute arbitrary database queries.

### 8.2 Model configuration

- Use Groq's API through the official SDK from server-side code.
- Make the model configurable using `GROQ_MODEL`.
- Initial model candidate: `openai/gpt-oss-120b`.
- Benchmark `openai/gpt-oss-20b` as a lower-cost alternative using the same representative tool-calling tasks.
- Confirm the selected model's current availability and structured tool-calling behavior before production release. If unsupported or unreliable, test `llama-3.3-70b-versatile`.
- The application must not hardcode model IDs in multiple places.
- Do not assume that a text-only chat model can inspect images. Image understanding, if required, must use a model and API path that explicitly support it.

### 8.3 Approved tools and safety

The assistant may call only narrowly scoped server-side tools, such as:
- Search catalogue items.
- Create a category.
- Create a draft catalogue item from an uploaded image.
- Update specified metadata fields for a specified item.
- Retrieve import status.
- Suggest category/color/description for review, if supported.
- Publish or unpublish an item only through a validated, explicit operation.

Every operation must:
- Validate inputs on the server.
- Check admin authorization.
- Use allowlisted operations and fields.
- Confirm the target item exists.
- Require explicit confirmation for destructive or consequential operations, such as permanent deletion or bulk changes.
- Return truthful success/error results.
- Log useful administrative/import events without logging secrets.

Never provide the model with unrestricted database credentials, arbitrary shell execution, unrestricted filesystem access, or arbitrary code execution. Treat text found in image filenames, metadata, and imported files as untrusted data.

## 9. Data model requirements

A catalogue item should contain fields along these lines (adapt names to the chosen implementation):

- `_id`: MongoDB document ID.
- `itemId`: stable unique public ID, e.g. `FB-000123`.
- `slug` or route key: permanent public route identifier, if needed.
- `title` or short label: optional; do not invent it if unknown.
- `description`: optional.
- `categoryId` or category reference: optional until reviewed.
- `colorTags`: optional list of known colors.
- `image`: Cloudinary `publicId`, secure URL, original filename and optional dimensions/format/size.
- `sourceRelativePath`: original relative path, for traceability.
- `contentHash`: checksum used for duplicate detection.
- `status`: use only workflow states such as `draft`, `needs_review`, `published`, or `archived` if needed. Do not use availability status.
- `createdAt` and `updatedAt`.
- `importBatchId` or import audit metadata where useful.

There must be no unit-of-sale field, available/unavailable field, stock/quantity field, checkout/payment fields, or customer-account fields in the first release.

The database should enforce uniqueness for `itemId` and any permanent route key. Public routes should query by stable ID/slug and handle missing or unpublished records safely.

## 10. Security, privacy, and reliability

- Store secrets only in environment variables or a managed secrets store.
- Keep `.env.local` out of Git.
- Protect admin pages and APIs with server-side authorization.
- Validate all incoming data with a schema-validation library or equivalent.
- Restrict image upload types and size.
- Use secure Cloudinary uploads and never expose API secrets to the browser.
- Rate-limit sensitive public/admin endpoints where appropriate.
- Sanitize and encode user-controlled text in the UI.
- Add useful error handling and avoid exposing stack traces or secrets to visitors.
- Use safe deletion and import-recovery behavior.
- Configure production environment variables separately from local development.
- Provide an `.env.example` containing placeholders only.

## 11. Suggested environment variables

Use only variables actually needed by the final implementation; names may be adapted consistently.

```env
MONGODB_URI=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FABRICMANE_WHATSAPP_NUMBER=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
FABRIC_IMPORT_ROOT=
```

`FABRIC_IMPORT_ROOT` should point to the actual local image folder and should not be exposed as a public client-side variable. Do not commit real values. The production `NEXT_PUBLIC_SITE_URL` must be set to the confirmed domain before launch.

## 12. UX and visual design

- Use Fabricmane's actual logo and brand colors once the supplied assets are reviewed.
- Create a clean, spacious, premium-feeling fabric catalogue.
- Avoid generic AI-looking layouts, excessive gradients, or unnecessary animation.
- Prioritize clear imagery, readable text, intuitive category navigation, and mobile usability.
- Use consistent typography, spacing, button styles, and card treatments.
- Include loading, empty, error, and success states.
- For the admin dashboard, prioritize practical bulk-management and review workflows over decorative visuals.
- Do not fabricate ratings, prices, testimonials, stock status, or business details.

## 13. Testing and acceptance criteria

The project is acceptable when:

1. The app runs locally with the existing Next.js project setup.
2. The home page and catalogue render correctly on mobile and desktop.
3. Public visitors can browse categories and open an individual fabric page.
4. Each published item has a unique stable ID and a permanent URL.
5. The WhatsApp button opens the configured business number with the fabric ID and public URL prefilled.
6. No cart, checkout, payment gateway, availability toggle, or unit-of-sale field appears.
7. Only the authorized admin can access the dashboard and admin APIs.
8. The admin can create and edit item metadata.
9. The importer discovers images in the configured root and all nested subfolders.
10. The importer has a dry-run mode and a clear summary of discovered, imported, skipped, duplicate, and failed files.
11. Importing the same source collection twice does not create duplicate records or duplicate uploads.
12. A failed upload does not produce a published item with a broken image.
13. Imported images are stored in Cloudinary, while MongoDB stores references and metadata.
14. Unsorted items can be placed in a review queue and categorized later.
15. The AI assistant can perform approved tool calls and reports results accurately.
16. Invalid tool arguments and unauthorized requests are rejected server-side.
17. Secrets and original fabric collections are not staged or pushed to GitHub.
18. `.env.example` contains placeholders only, and production secrets are configured securely.
19. Missing items and failed operations produce clear, graceful UI states.
20. Core functionality has automated tests where practical, plus a documented manual smoke-test checklist.

## 14. Implementation approach

Build incrementally and verify each stage before moving on:

1. Inspect the current repository, existing dependencies, routes, and environment variable names.
2. Establish project rules and visual design conventions.
3. Build the data models, validation, database connection, and admin authentication.
4. Build public layout, category browsing, catalogue cards, and item detail routes.
5. Build the WhatsApp enquiry link.
6. Build admin CRUD and image preview.
7. Build the recursive, idempotent bulk importer with dry-run and error reporting.
8. Integrate Cloudinary and MongoDB and test a small batch.
9. Build the uncategorized review queue.
10. Add the Groq assistant with allowlisted tools and confirmation for sensitive changes.
11. Test responsive behavior, security, duplicate handling, error cases, and production configuration.
12. Deploy only after environment variables and the WhatsApp number/domain are configured.

Antigravity should modify the existing project carefully, explain significant file changes, avoid replacing working configuration unnecessarily, and run the available lint, type-check, and test commands after each major stage.

## 15. Open items to confirm before launch

- Final Fabricmane logo/brand variants and approved brand colors.
- Actual local asset directory path.
- Fabricmane WhatsApp number in international format.
- Production domain.
- Admin authentication method and credentials setup.
- Which categories the owner wants; unknown images can remain uncategorized until reviewed.
- Which images should be featured on the home page.
- Whether the selected Groq model's tool-calling performance meets requirements.

These are configuration/content decisions and should not block building the core structure, recursive importer, and catalogue workflow.
