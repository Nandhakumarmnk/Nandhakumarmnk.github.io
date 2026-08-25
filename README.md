# Nandhakumar M — Portfolio

Personal portfolio site for **Nandhakumar M**, Senior .NET Full-Stack Developer — React.js, ASP.NET Core, C#.

**Live at:** <https://nandhakumarmnk.github.io/>
Published from the `Nandhakumarmnk.github.io` repo, which also hosts the E-Palace field-order PWA at
`/epalace/` and its Android asset links at `/.well-known/`. **Never delete or rename those** — the signed
E-Palace APK verifies its app links against this origin, and the installed PWA scope is `/epalace/`.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire site — HTML, CSS, and JS in one self-contained file. No build step, no dependencies. |
| `Nandhakumar_M_Resume.pdf` | Résumé served by the "Download Résumé" buttons. Currently a copy of `Nandhakumar_M_Senior_DotNet_FullStack_Resume_v4.pdf` from the parent folder — replace this file to update the download. |

## Run locally

Just double-click `index.html`. It works straight from the filesystem — there is no server requirement.

## Deploy

The site is published from **two** repos:

| Repo | Branch | URL | Role |
|---|---|---|---|
| `Nandhakumarmnk.github.io` | `master` | <https://nandhakumarmnk.github.io/> | Canonical — the URL on the résumé |
| `portfolio` | `main` | <https://nandhakumarmnk.github.io/portfolio/> | Mirror, kept alive so older links still resolve |

`Nandhakumarmnk.github.io` is a **shared** repo — the portfolio occupies the root, and the E-Palace
field-order PWA occupies `/epalace/` with its asset links in `/.well-known/`. Deploy by copying
`index.html`, `README.md`, and `Nandhakumar_M_Resume.pdf` into a clone of that repo. **Never** force-push
this folder over it wholesale — that would delete `epalace/` and `.well-known/` and take down the client
app and its Android app-link verification.

```bash
# mirror repo — safe, this folder is the whole repo
cd D:/Resume/portfolio
git add .
git commit -m "Update portfolio"
git push origin main
```

## Updating content

Everything is plain HTML — edit `index.html` directly.

- **Hero stats** — the `data-count` and `data-suffix` attributes drive the animated counters.
  `data-count="500" data-suffix="+"` renders as `500+`.
- **Projects / Freelance** — two sections, `#projects` (enterprise) and `#freelance` (own products).
  Copy an entire `<article class="proj">` block to add another. Add `class="proj feature"` to make one
  span the full row. The grid is 2-column at desktop, so keep the number of non-feature cards **even**
  or the last row will have an empty slot.
- **Project links** — the `.proj-links` block holds "Live Site" / "Source" buttons.
  Add `class="plink live"` to highlight a live demo in the accent colour.
- **Skills** — each `<div class="skill-card">` is one category; `<span class="tag">` is one chip.
  Cards are ordered deliberately: **Frontend (Modern) → Frontend (Server-Side) → Backend → Database →
  Cloud/DevOps → Security → Integrations → Reporting → Mobile → Practices → AI**. React and TypeScript
  lead the first card; jQuery, Razor, and DevExtreme sit in the server-side card so the profile does not
  read as legacy MVC.
- **Experience** — each `<div class="tl-item">` is one timeline entry.
- **Contact links** — in the `#contact` section. Update the `mailto:`, `tel:`, and LinkedIn `href`s together
  with their visible label text. Note `.contact-links` is `display:none` in the print stylesheet, so these
  links do not appear in a `Ctrl+P` export — that is intentional.

## Notes

- **Theme** — dark by default, with a light toggle in the navbar. The choice persists in `localStorage`
  and falls back to the visitor's OS preference on first visit.
- **Self-contained** — no CDN, no external fonts, no analytics. It renders offline and cannot break
  because a third party went down.
- **Responsive** — verified with no horizontal overflow down to a 360px viewport.
- **Accessibility** — honours `prefers-reduced-motion`; all animation is disabled for visitors who ask for that.
- **Printable** — `Ctrl+P` produces a clean document; navigation, buttons, and background effects are hidden.

## Suggested additions

A **public React sample repository** would be the highest-value addition. The Vendor Portal is the
lead project and the React work is described in detail, but there is no code a recruiter can open —
a small public repo linked from that project's `.proj-links` block would close the gap.

A professional photo in the hero and any certifications you hold would both strengthen the page further.
