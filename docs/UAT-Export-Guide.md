# How to compile `UAT-Plan.md` into a client-ready PDF or Word file

The UAT plan is written in Markdown ([UAT-Plan.md](UAT-Plan.md)). Pick whichever route fits your tooling — **Pandoc** gives the cleanest, most professional result; the no-install options are great if you just need it fast.

> The cover sheet uses a `\newpage` marker that becomes a real page break in PDF/Word via Pandoc (see below). The no-install tools render it as a normal heading; that's fine.

---

## Option A — Pandoc (recommended, best looking)

### 1. Install (once)
| OS | Command |
|---|---|
| **Windows** | `winget install --id JohnMacFarlane.Pandoc` (or `choco install pandoc`) |
| **macOS** | `brew install pandoc` |
| **Linux** | `sudo apt-get install pandoc` |

For **PDF** output Pandoc needs a PDF engine. Easiest is a LaTeX install **or** `wkhtmltopdf`:
- LaTeX: Windows `choco install miktex` · macOS `brew install --cask basictex` · Linux `sudo apt-get install texlive-xetex`
- or lightweight HTML engine: `choco install wkhtmltopdf` / `brew install wkhtmltopdf` / `sudo apt-get install wkhtmltopdf`

### 2. Generate the files
Run these from the repo's `docs/` folder.

**Word (.docx)** — most clients prefer this for adding signatures/comments:
```bash
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.docx"
```

**PDF via LaTeX (sharpest typography):**
```bash
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.pdf" \
  --pdf-engine=xelatex \
  -V geometry:margin=2cm \
  -V mainfont="Calibri" \
  -V linkcolor:blue \
  --toc --toc-depth=2
```

**PDF via wkhtmltopdf (no LaTeX needed):**
```bash
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.pdf" \
  --pdf-engine=wkhtmltopdf \
  -V margin-top=18 -V margin-bottom=18 -V margin-left=16 -V margin-right=16 \
  --toc --toc-depth=2
```

**With a title page + auto table of contents (nice for sign-off packs):**
```bash
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.pdf" \
  --pdf-engine=xelatex --toc --toc-depth=2 \
  -V geometry:margin=2cm -V linkcolor:blue \
  --metadata title="Fancy RSVP — UAT Plan & Sign-off" \
  --metadata author="QA / Project Lead" \
  --metadata date="$(date +%F)"
```

> **PowerShell note:** replace the trailing `\` line-continuations with a backtick `` ` `` (or put the whole command on one line).

### 3. (Optional) brand it
Add a logo/footer with a header file or a reference docx:
```bash
# Word: use your own styled template as the look-and-feel
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.docx" --reference-doc=company-template.docx
```

---

## Option B — Node (no Pandoc/LaTeX)

`md-to-pdf` (uses headless Chromium under the hood — good CSS/page-break support):
```bash
npx md-to-pdf UAT-Plan.md
# produces UAT-Plan.pdf in the same folder
```

---

## Option C — Zero install (GUI)

- **VS Code:** install the **“Markdown PDF”** extension (yzane) → open `UAT-Plan.md` → right-click → **Markdown PDF: Export (pdf)** (also exports docx/html).
- **Typora** (paid) or **Obsidian** (free): open the file → **Export → PDF / Word**.
- **Google Docs:** install the free **“Docs to Markdown”** add-on (or paste into a converter), then **File → Download → PDF / Word**. Quickest if the client lives in Google Workspace.

---

## Recommended deliverables to hand the client
| File | Use |
|---|---|
| `Fancy-RSVP-UAT-Plan.pdf` | read-only, print, archive |
| `Fancy-RSVP-UAT-Plan.docx` | client fills checkboxes, adds notes, signs |

**One-liner to produce both with Pandoc:**
```bash
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.pdf" --pdf-engine=xelatex -V geometry:margin=2cm --toc --toc-depth=2 && \
pandoc UAT-Plan.md -o "Fancy-RSVP-UAT-Plan.docx"
```

---

### Troubleshooting
- **`pdflatex/xelatex not found`** → install LaTeX (above) or switch to `--pdf-engine=wkhtmltopdf`.
- **Tables look cramped in PDF** → widen margins (`-V geometry:margin=1.5cm`) or use the wkhtmltopdf engine, which wraps wide tables better.
- **Checkboxes show as `☐`** → that's the intended empty checkbox glyph; ensure the font supports it (Calibri/Segoe UI/DejaVu all do). For ASCII fallback, find-and-replace `☐` with `[ ]` before converting.
- **Page break not applying in Word** → Pandoc converts `\newpage` to a real page break in docx/PDF; the no-install tools may not — add a manual page break in Word after the cover page if needed.
