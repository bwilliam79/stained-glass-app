# Stained Glass Pattern Maker

A browser-based tool that converts any image into a ready-to-cut stained glass pattern. Upload a photo or design, configure the number of colors and piece complexity, and export print-ready PDFs, PNGs, or SVGs with came compensation baked in.

All processing happens in the browser — no backend, no account required.

---

## Features

### Pattern Generation
- Upload PNG, JPG, WebP, or GIF images
- K-means color quantization reduces the image to 2–20 distinct glass colors
- Gaussian blur simplification controls piece granularity
- Acute angles (<30°) are automatically beveled to prevent glass cracking
- Thin pieces (<3/8") that can't be cut are automatically merged into neighbors

### Came Compensation
- Select standard came heart widths: 1/16", 3/32", 1/8", 3/16", 1/4"
- Each piece is inset by half the came width so the assembled result matches your target dimensions

### Preview
- Two view modes: colored pattern and cutting guide (outline only)
- Zoom levels: 0.5×, 1×, 1.5×, 2×

### Materials Estimate
- Total glass area (sq ft) per color with waste factor (5–40%)
- Interior and perimeter lead came length
- Solder weight estimate (50/50 tin/lead)

### Export
- **PDF**: Colored pattern, cutting guide, and individual piece templates — with multi-page tiling and registration marks for large patterns
- **PNG**: High-res colored and outline versions
- **SVG**: Scalable colored pattern and cutting guide

### Dimensions
- Set width and height in inches or centimeters
- Aspect ratio is preserved automatically

---

## Running the App

This is a static Vite/React app with no backend.

**Development:**
```bash
npm install
npm run dev
```
Opens at `http://localhost:5173` with hot reload.

**Production build:**
```bash
npm run build
```
Output goes to `dist/`. Deploy to any static host (Netlify, GitHub Pages, S3, etc.).

---

## Tech Stack

- **React 18** — UI
- **Vite 6** — Build tool
- **Tailwind CSS 3** — Styling
- **jsPDF** — PDF generation
- **Browser Canvas API** — Image processing and pattern rendering
