# Fabricmane — Design System

## Brand direction
Use the REAL logo (`docs/brand/logo-light.jpg`; export a transparent SVG/PNG into `public/` before launch). Page background is pure WHITE. The logo's red is the only accent colour; text is the logo's warm near-black. Typography matches the logo's bold, tight grotesque wordmark. The fabric photographs are the hero.
Avoid: gold or beige palettes, serif display fonts, purple, blue gradients, neon, glassmorphism, SaaS-style cards, stock illustrations, emoji in UI.
Signature motif: the logo's red lattice. Use it sparingly (hero graphic, divider band, empty states, favicon). Do not tile it behind content.

## Tokens (sampled from the logo)
| Token | Value |
|---|---|
| --bg | #FFFFFF |
| --text | #201414 |
| --muted | #6F6764 |
| --line | #E8E4E1 |
| --tile | #F4F2EF (photo placeholder) |
| --red | #E32F2D (primary accent, buttons, fabric IDs) |
| --red-dark | #B81F1E (hover) |
| --danger | #B3261E |
| --success | #2F6B3F |

## Typography
- One family: Hanken Grotesk (or Inter Tight), weights 400/500/700/800, via `next/font`.
- Headings 800 weight, letter-spacing -0.035em, tight line height. Body 16px, 1.55 line height.
- Sentence case everywhere. No all-caps labels.
- Buttons: fully rounded pill, red fill (primary) or black outline (secondary).

## Layout
- Max content width 1200px, 24px mobile gutters, large vertical rhythm (80-120px between sections on desktop).
- Fabric grid: 2 columns mobile, 3 tablet, 4 desktop. Images 4:5 aspect, `object-cover`.
- Rounded photo tiles (14px), pill buttons and chips, 1.5px borders. Minimal shadows; hover shows a red outline.

## Storefront pages
- **Header:** logo left, nav (Home, Fabrics, Contact), WhatsApp button right; mobile slide-in menu.
- **Home:** full-width hero with a real fabric photo + headline + "View Fabrics" CTA; Featured fabrics; New arrivals; Browse by category; short brand statement (do not invent claims); WhatsApp CTA band; footer.
- **Catalogue:** sticky search bar, category chips, grid, "Load more". Cards show image, fabric ID (FB-000123), name if any, price or "Enquire for Price".
- **Fabric page `/f/[fabricId]`:** large image gallery, fabric ID, category, colors, description, price/"Enquire for Price", primary button "Enquire on WhatsApp", Copy link button, related fabrics from the same category.
- **Footer:** Instagram and Threads @thefabricmane, WhatsApp link, nav links.

## Admin
- Calm, functional, same fonts and colors. Left sidebar (Overview, Fabrics, Needs Review, Assistant) collapsing to a bottom/top bar on mobile.
- Fabrics table/grid with search, bulk select for category assignment, inline quick edit.
- Needs Review: grid of unsorted images, multi-select, assign category/colors, publish.
- Destructive actions use a confirm dialog naming the fabric ID.
- Toasts for success/error.

## Assistant UI
- Chat panel with message bubbles, image upload button, typing/loading indicator.
- Suggested prompts as chips.
- Pending actions appear as a **preview card** (old vs new values, fabric ID, thumbnail) with Confirm and Cancel buttons. Label content clearly as "Suggested" vs "Saved".

## Components to build
Button, Input, Select, Chip, FabricCard, FabricGrid, FabricGallery, EnquireButton, SearchBar, CategoryFilter, Header, Footer, Dialog, Toast, Skeleton, EmptyState, ErrorState, PreviewCard, ChatMessage.

## Motion
red outline on image hover. Respect `prefers-reduced-motion`.

## Accessibility
Contrast AA, focus rings in accent-dark, keyboard-operable menus and dialogs, alt text from fabric name/ID/category.