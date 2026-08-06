# Store assets (generated)

Regenerate with:

    node backend/scripts/build-store-assets.mjs

Do not edit these by hand — the script derives both from
`mobile/assets/icon.png`, the launcher icon the app actually ships, so they
cannot drift from what a user sees on their home screen. It asserts the source
is 1024x1024 and that its background is exactly brand-600 (#0d8a5f), and throws
rather than producing an off-brand image.

| File | Size | Where it goes |
|---|---|---|
| `play-icon-512.png` | 512x512 PNG | Play Console → Store listing → App icon |
| `play-feature-graphic-1024x500.png` | 1024x500 PNG, no alpha | Play Console → Store listing → Feature graphic |

**The wordmark is set, not approximated.** What has no vector source or
recoverable font is the single **S glyph** — the wordmark is plain text in the
display font (`.claude/ui-ux.md`), so it is rendered from the same Sora Bold
TTF the app ships, with `Stay` white and `OnMap` brand-100 per the
on-brand-green rule. The tagline is verbatim from
`docs/play-store-listing.md`'s recommended short description, so the graphic
and the listing cannot drift apart.

The right third is left empty on purpose: Play overlays the app title and
install button over part of this image on some surfaces.

**Screenshots are not generated here.** Play needs 2-8 real device screenshots,
which come from a build on a device — no script can invent them.
