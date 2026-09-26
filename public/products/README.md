# Put product photos here

Drop one image per SKU in this folder, named after the perfume, then run:

```bash
npm run media:manifest
```

That writes `manifest.json`, which the dashboard reads on load — committed photos
appear for everyone who opens the app.

## Naming

The file name is matched to a SKU by slug, so any of these work for the same product:

- `sauvage.jpg`
- `dior-sauvage.jpg`
- `sauvage-dior.png`
- `khamrah.webp`

Rules: lowercase, spaces → `-`, accents removed. `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`
and `.gif` are all supported.

## Tips

- 720 × 720 px is plenty (the dashboard uses small thumbnails and cards).
- Keep each file under ~400 KB; `npm run media:manifest` warns you about heavier ones.
- Dark, close-up shots with a plain background match the "Fire in Darkness" look best.
- A product with no photo still looks finished — the dashboard renders a gold monogram
  built from the brand initials instead.

## Faster alternative

You don't have to touch the repo at all: open **Data & Photos** in the dashboard and
drag photos straight onto the page (or use *Upload photo* on any product card). Those
stay in your browser; the folder here is the permanent, shared version.
