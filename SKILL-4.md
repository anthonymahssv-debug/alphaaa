---
name: real-estate-image-downloader
description: Extract and download property photos from public real estate listing links with built-in intelligence for three Santa Fe CDMX towers — Paradox, Torre 300, and Península Tower 546. Use whenever the user asks to get, pull, extract, or download images from real estate listings, broker pages, Inmuebles24 pages, Lamudi pages, or any Mexican real estate portal. Handles three operational modes — single unit, batch units, and tower aggregation — and separates output into interior versus exterior sets at both unit level and tower level. Produces unit-level galleries, tower-level visual libraries, a consolidated CSV manifest, and a zip bundle ready for ingestion into the SF 546 CI intelligence platform.
license: MIT
metadata:
  author: Ricardo Guzmán Manzanera
  version: "2.0"
  primary_targets: ["inmuebles24.com", "lamudi.com.mx"]
  tower_scope: ["paradox", "torre-300", "peninsula-546"]
  downstream_platform: "SF 546 CI"
---

# Real Estate Image Downloader — v2.0 (SF 546 CI Edition)

## 1. When to Use This Skill

Trigger this skill whenever the user asks you to:

- Download photos from one or more real estate listings.
- Extract direct image URLs from public broker or portal pages.
- Build a tower-wide visual library from multiple listings of the same building.
- Produce separated interior and exterior image sets for any of the three towers in scope.
- Turn Inmuebles24 or Lamudi URLs into a clean, ready-to-ingest image package.

Use only on public pages. If a listing requires login or is paywalled, stop and request a public URL or a saved export.

## 2. Tower Scope — SF 546 CI

The skill is optimized for three specific towers in Santa Fe, Mexico City. Built-in identification signals are provided so the skill can correctly tag any listing that falls inside the scope.

### 2.1 Paradox Santa Fe

- Official name variants: `Paradox`, `Torre Paradox`, `Paradox Santa Fe`
- Address signals: `Javier Barros Sierra`, Santa Fe
- Canonical tag: `paradox`
- Common portal phrases: "Paradox", "en Paradox", "Torre Paradox"

### 2.2 Torre 300

- Official name variants: `Torre 300`, `Torre300`, `T300`
- Address signals: `Javier Barros Sierra 300`, Santa Fe
- Canonical tag: `torre-300`
- Common portal phrases: "Torre 300", "en Torre 300", "T300 Santa Fe"

### 2.3 Península Tower 546

- Official name variants: `Península`, `Peninsula`, `Península Santa Fe`, `Península Tower 546`, `Peninsula 546`
- Address signals: `Javier Barros Sierra 546`, Santa Fe
- Canonical tag: `peninsula-546`
- Common portal phrases: "Península", "Peninsula Santa Fe", "Torre Península", "546"

### 2.4 Tower Detection Rules

Run tower detection on every listing before saving images. Detection sources, in priority order:

1. Page title and H1.
2. Listing description body.
3. Address field.
4. Breadcrumb or neighborhood tags.
5. URL slug.

A listing is considered in-scope when at least one of the official name variants is matched, or when the address signal matches. If none match, tag the listing as `out-of-scope` and only save images if the user explicitly requested a non-scope URL.

## 3. Operational Modes

The skill operates in one of three modes. The user's request determines which.

### 3.1 Mode A — Single Unit

- Input: one listing URL.
- Output: all photos from that one unit, split into interior and exterior sets.
- Use when: "get the photos of this unit", "download this listing", a single URL in the prompt.

### 3.2 Mode B — Batch Units

- Input: two or more listing URLs (same or mixed towers).
- Output: per-listing folders, each preserving the unit identity, all with interior and exterior splits, plus a consolidated CSV manifest and zip bundle.
- Use when: the user sends multiple links, asks for "all these listings", or uploads a list of URLs.

### 3.3 Mode C — Tower Aggregation

- Input: a tower name, or a set of listings for the same tower, or a command like "build a visual library for Paradox".
- Output: a deduplicated tower-level visual library of the building — façades, lobby, amenities, views, common areas — extracted from multiple listings and merged.
- Use when: the user wants a tower-wide gallery independent of any single unit, or the phrase "tower images", "building photos", "amenities of the tower", "façade", or "visual library" appears.
- Deduplication is mandatory. Many listings reuse the same façade and amenity photos. Use filename matching, URL canonicalization, and byte-level hashing as first-pass deduplication. Perceptual image hashing is optional if available.

The skill can run Mode B and Mode C in the same request — producing both per-unit galleries and a tower-wide library.

## 4. Interior vs Exterior Separation

Every saved image must be classified. Classification is applied after extraction and before saving.

### 4.1 Interior signals

- Room types: living room, dining room, kitchen, bedroom, bathroom, closet, office, laundry.
- Indoor amenities: gym interiors, spa rooms, cinema rooms, tasting rooms, co-working lounges.
- Interior finishes visible: cabinetry, flooring, walls, ceilings, countertops.
- Caption cues in Spanish: "sala", "comedor", "cocina", "recámara", "baño", "vestidor", "estudio".

### 4.2 Exterior signals

- Façade, tower silhouette, skyline context.
- Entrance, motor lobby, drop-off, porte-cochère.
- Outdoor amenities: pool deck, rooftop terrace, garden, paddle court, jogging track.
- Views from balcony or terrace facing outward.
- Aerial or site-plan imagery.
- Caption cues in Spanish: "fachada", "exterior", "vista", "terraza", "amenidades".

### 4.3 Ambiguous cases

- Terraces with furniture and interior context → classify as `interior` if the frame is dominated by the unit's interior, `exterior` if the frame is dominated by the view.
- Renderings → preserve the classification logic above; flag `render: true` in the manifest.

### 4.4 Output separation

Interior and exterior images are always saved into separate subfolders. Never mix them in the same folder, even when the user did not explicitly ask for the split — the split is always produced.

## 5. Output Folder Structure

All outputs use this structure. This is non-negotiable so downstream ingestion into SF 546 CI is deterministic.

```
/sf546-images/
├── paradox/
│   ├── tower/
│   │   ├── interior/
│   │   └── exterior/
│   └── units/
│       ├── inm24-{listing_id}/
│       │   ├── interior/
│       │   └── exterior/
│       └── lam-{listing_id}/
│           ├── interior/
│           └── exterior/
├── torre-300/
│   ├── tower/
│   │   ├── interior/
│   │   └── exterior/
│   └── units/
│       └── ...
├── peninsula-546/
│   ├── tower/
│   │   ├── interior/
│   │   └── exterior/
│   └── units/
│       └── ...
├── out-of-scope/
│   └── units/
│       └── ...
└── manifest.csv
```

If a single mode is requested, produce only the relevant branches of this tree. Do not invent parallel structures.

## 6. Naming Conventions

Filenames must be deterministic, URL-safe, and human-readable.

### 6.1 Tower-level files

Pattern: `{tower}-tower-{type}-{NN}.{ext}`

Examples:
- `paradox-tower-exterior-01.jpg`
- `torre-300-tower-interior-07.jpg`
- `peninsula-546-tower-exterior-03.jpg`

### 6.2 Unit-level files

Pattern: `{tower}-unit-{source_code}-{listing_id}-{type}-{NN}.{ext}`

Where `source_code` is:
- `inm24` for Inmuebles24
- `lam` for Lamudi
- `eb` for EasyBroker
- `prop` for Propiedades.com
- `viva` for Vivanuncios
- `pin` for Pincali

Examples:
- `paradox-unit-inm24-147826391-interior-01.jpg`
- `peninsula-546-unit-lam-58920-exterior-02.jpg`
- `torre-300-unit-inm24-146300012-interior-04.jpg`

### 6.3 Numbering

- Start at `01`, zero-padded to two digits.
- Continue sequentially within each interior/exterior group.
- Never re-use a number across a split. Interior starts at 01, exterior starts at 01.

### 6.4 Forbidden in filenames

- Spaces.
- Accented characters.
- Uppercase in the file stem.
- Brand or tracking parameters.

## 7. Source-Specific Extraction

### 7.1 Inmuebles24

- URL pattern: `https://www.inmuebles24.com/propiedades/.../-{listing_id}.html`
- Listing ID capture: trailing numeric ID before `.html`.
- Image locations to inspect:
  - `img` tags inside the gallery container.
  - `data-flickity-lazyload`, `data-src`, `data-lazy-src` attributes.
  - Inline JSON blobs inside `<script>` tags. Look for keys such as `"pictures"`, `"images"`, `"media"`, `"gallery"`.
  - Open Graph meta tags.
- CDN patterns: image hosts typically include `inmuebles24.com` or its image CDN subdomain. Prefer the largest size variant — the path usually contains a size token (e.g., `720x480`, `1200x900`). Request the largest available.
- Cleanup: strip tracking query strings.

### 7.2 Lamudi

- URL pattern: `https://www.lamudi.com.mx/.../{slug}-{listing_id}.html`
- Listing ID capture: trailing identifier in the slug.
- Image locations to inspect:
  - Gallery carousel `img` tags.
  - `data-src`, `data-original` attributes.
  - Inline JSON with keys like `"pictures"`, `"photos"`, `"images"`.
  - Open Graph meta tags.
- CDN patterns: image hosts under `lamudi.com.mx` or a dedicated image CDN. Prefer the largest stable variant.
- Cleanup: remove size tokens when a larger unmarked version resolves cleanly; otherwise keep the largest explicit size.

### 7.3 Fallback portals

The skill still supports EasyBroker, Propiedades.com, Vivanuncios, Pincali, Realtor.com International, Engel & Völkers, Lamudi, Metros Cúbicos, and Icasas using the same extraction logic. Apply the generic extraction checklist below when encountering a new portal.

### 7.4 Generic extraction checklist

When reading any listing page, check these locations in order:

1. `img src`
2. `srcset` (pick the largest candidate)
3. `data-src`, `data-lazy`, `data-lazy-src`, `data-original`, `data-flickity-lazyload`
4. JSON blobs inside `<script>` and `<script type="application/ld+json">`
5. Open Graph image tags (`og:image`, `og:image:secure_url`)
6. XHR or fetch payloads exposed by the page when rendered
7. Gallery lightbox endpoints

## 8. Deduplication

Mandatory for Mode C (Tower Aggregation) and recommended for Mode B.

Layered deduplication:

1. **URL canonicalization.** Strip size tokens and query strings, compare.
2. **Filename hash.** Hash the final filename stem.
3. **Byte hash.** SHA-256 of the downloaded file.
4. **Optional perceptual hash.** Use pHash or dHash when available to catch visually identical images served at different resolutions.

When duplicates are detected, keep the largest resolution and log the rejected copies in the manifest with `duplicate_of` populated.

## 9. CSV Manifest Schema

One row per image kept. Columns:

| Column | Description |
|---|---|
| `tower_code` | `paradox` / `torre-300` / `peninsula-546` / `out-of-scope` |
| `scope` | `tower` / `unit` |
| `source_code` | `inm24` / `lam` / `eb` / `prop` / `viva` / `pin` / `other` |
| `source_domain` | Full domain (e.g., `inmuebles24.com`) |
| `listing_id` | ID extracted from URL or page |
| `unit_identifier` | Human-readable unit label if available (e.g., `Piso 18 A`) |
| `image_type` | `interior` / `exterior` / `unclear` |
| `image_label` | Room or area tag (e.g., `living_room`, `kitchen`, `facade`, `lobby`, `pool`, `gym`, `view`) |
| `image_url` | Direct image URL |
| `source_page` | Listing page URL |
| `filename` | Saved filename |
| `folder_path` | Relative path under `/sf546-images/` |
| `resolution` | `{width}x{height}` if resolvable |
| `byte_hash` | SHA-256 of saved file |
| `is_render` | `true` / `false` |
| `duplicate_of` | Filename of the kept copy if this row was a deduplicated alternate (else blank) |
| `extracted_at` | ISO timestamp of extraction |

## 10. Workflow

1. **Parse input.**
   - Single URL → Mode A.
   - Multiple URLs → Mode B.
   - Tower name or aggregation keyword → Mode C.
   - Mixed instructions → run both modes as needed.
2. **Open each listing page.**
3. **Run tower detection** per Section 2.4. Assign `tower_code`.
4. **Extract image URLs** per Section 7. Normalize to the largest usable variant.
5. **Classify each image** per Section 4. Assign `image_type` and, when possible, `image_label`.
6. **Deduplicate** per Section 8 — mandatory for Mode C.
7. **Download and save** images into the Section 5 folder tree with Section 6 filenames.
8. **Write the CSV manifest** per Section 9.
9. **Zip the final bundle** as `/sf546-images.zip` rooted at the `sf546-images` folder.
10. **Deliver** the zip plus a concise summary: towers detected, counts per tower, counts per interior/exterior, counts deduplicated, out-of-scope listings noted.

## 11. Quality Bar

Before returning the deliverable, confirm:

- Every saved file opens.
- No thumbnails survived when a larger variant was available.
- Interior and exterior folders contain the right content after a spot check.
- Every listing was tagged with a valid `tower_code` or explicitly `out-of-scope`.
- The manifest row count equals the saved file count.
- The zip bundle opens and preserves the folder tree.
- Filenames are all lowercase, URL-safe, and follow Section 6.
- No duplicate file stems exist inside any single folder.

## 12. User-Facing Response Pattern

Keep the final reply short and executive:

- Mode used.
- Towers detected and count per tower.
- Interior count and exterior count per scope.
- Out-of-scope or failed URLs with reason.
- Path or link to the zip bundle.

No code output in the reply unless the user asked for it. No promotional language.

## 13. Examples

### Example 1 — Mode A

> "Get the photos of this Inmuebles24 link."

- Detect tower → `paradox`.
- Extract 24 images, classify 18 interior / 6 exterior.
- Save to `paradox/units/inm24-{listing_id}/interior|exterior/`.
- Deliver zip and 5-line summary.

### Example 2 — Mode B

> "Download all photos from these 14 Lamudi and Inmuebles24 links."

- Detect towers → 6 Península, 5 Paradox, 3 Torre 300.
- Save each unit into its own folder under the correct tower.
- Generate `manifest.csv`.
- Deliver `/sf546-images.zip` and a per-tower count summary.

### Example 3 — Mode C

> "Build a tower visual library for Paradox from Inmuebles24 and Lamudi."

- Search public listings, pick a strong sample.
- Extract, classify, and deduplicate across the sample.
- Produce `paradox/tower/interior` and `paradox/tower/exterior` galleries.
- Deliver zip plus dedup counts.

### Example 4 — Mixed

> "Pull everything for these 8 Peninsula links and also build me a Peninsula tower library."

- Run Mode B on the 8 links (unit galleries).
- Run Mode C on the aggregated content for `peninsula-546`.
- Deliver both branches in one zip.

## 14. Limits and Caveats

- Login-gated listings cannot be read. Ask for a public URL or export.
- Some portals rotate images on every visit; one pass may miss a few. A second pass can be requested.
- Image licensing is not verified. The skill does not assert reuse rights.
- When the tower cannot be confidently identified, the listing goes into `out-of-scope` rather than being force-assigned.

## 15. Change Log

- **v2.0** — SF 546 CI edition. Added three operational modes (A, B, C). Added built-in tower detection for Paradox, Torre 300, Península 546. Enhanced CSV schema with `tower_code`, `scope`, `byte_hash`, `duplicate_of`. Introduced deterministic folder tree. Tightened Inmuebles24 and Lamudi extraction patterns. Added mandatory interior/exterior split at both tower and unit level.
- **v1.0** — Initial generic skill.
