import jsPDF from 'jspdf';

// Letter page dimensions in inches
const PAGE_W = 8.5;
const PAGE_H = 11;
const MARGIN = 0.5;
const PRINT_W = PAGE_W - 2 * MARGIN;
const PRINT_H = PAGE_H - 2 * MARGIN;

function inchesToPt(inches) {
  return inches * 72;
}

function addPageHeader(pdf, title, pageNum, totalPages, tileInfo) {
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(`${title}`, MARGIN, MARGIN - 0.1);
  if (totalPages > 1) {
    pdf.text(`Page ${pageNum} of ${totalPages} — ${tileInfo}`, PAGE_W - MARGIN, MARGIN - 0.1, { align: 'right' });
  }
  pdf.setTextColor(0);
}

function addRegistrationMarks(pdf, x, y, w, h) {
  const markSize = 0.15;
  pdf.setDrawColor(150);
  pdf.setLineWidth(0.01);
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  for (const [cx, cy] of corners) {
    pdf.line(cx - markSize, cy, cx + markSize, cy);
    pdf.line(cx, cy - markSize, cx, cy + markSize);
  }
  pdf.setDrawColor(0);
}

function addScaleBar(pdf, x, y) {
  const barW = 1;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.02);
  pdf.line(x, y, x + barW, y);
  pdf.line(x, y - 0.05, x, y + 0.05);
  pdf.line(x + barW, y - 0.05, x + barW, y + 0.05);
  pdf.setFontSize(7);
  pdf.text('1 inch', x + barW / 2, y + 0.12, { align: 'center' });
}

export async function exportColoredPDF(patternCanvas, settings) {
  const { width, height, units } = settings;
  const artWIn = units === 'in' ? parseFloat(width) : parseFloat(width) / 2.54;
  const artHIn = units === 'in' ? parseFloat(height) : parseFloat(height) / 2.54;
  await generatePDF(patternCanvas, artWIn, artHIn, 'Stained Glass Pattern — Colored', 'stained-glass-pattern-colored.pdf');
}

export async function exportOutlinePDF(outlineCanvas, settings) {
  const { width, height, units } = settings;
  const artWIn = units === 'in' ? parseFloat(width) : parseFloat(width) / 2.54;
  const artHIn = units === 'in' ? parseFloat(height) : parseFloat(height) / 2.54;
  await generatePDF(outlineCanvas, artWIn, artHIn, 'Stained Glass Pattern — Cutting Guide', 'stained-glass-pattern-outline.pdf');
}

async function generatePDF(canvas, artWIn, artHIn, title, filename) {
  if (!canvas || !canvas.width || !canvas.height) {
    throw new Error('exportPDF: source canvas has zero width or height; nothing to export.');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  if (artWIn <= PRINT_W && artHIn <= PRINT_H) {
    const imgData = canvas.toDataURL('image/png');
    const xOff = MARGIN + (PRINT_W - artWIn) / 2;
    const yOff = MARGIN + (PRINT_H - artHIn) / 2;

    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, PAGE_W / 2, MARGIN - 0.15, { align: 'center' });
    pdf.setFont(undefined, 'normal');

    pdf.addImage(imgData, 'PNG', xOff, yOff, artWIn, artHIn);

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.02);
    pdf.rect(xOff, yOff, artWIn, artHIn);

    addScaleBar(pdf, xOff, yOff + artHIn + 0.2);

    pdf.setFontSize(8);
    pdf.text(`${artWIn}" × ${artHIn}"`, PAGE_W / 2, yOff + artHIn + 0.35, { align: 'center' });

  } else {
    const tilesX = Math.ceil(artWIn / PRINT_W);
    const tilesY = Math.ceil(artHIn / PRINT_H);
    const totalPages = tilesX * tilesY;
    let pageNum = 0;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        pageNum++;
        if (pageNum > 1) pdf.addPage();

        const srcX = tx * PRINT_W;
        const srcY = ty * PRINT_H;
        const srcW = Math.min(PRINT_W, artWIn - srcX);
        const srcH = Math.min(PRINT_H, artHIn - srcY);

        // Validate the source canvas — a zero-dimension canvas would cause
        // drawImage to throw with a confusing "source width is 0" error.
        if (!canvas || !canvas.width || !canvas.height) {
          throw new Error('exportPDF: source canvas has zero width or height; cannot tile.');
        }

        const tileCanvas = document.createElement('canvas');
        const scaleFactor = canvas.width / artWIn;
        tileCanvas.width = Math.max(1, Math.round(srcW * scaleFactor));
        tileCanvas.height = Math.max(1, Math.round(srcH * scaleFactor));
        const tileCtx = tileCanvas.getContext('2d');
        tileCtx.drawImage(
          canvas,
          Math.round(srcX * scaleFactor), Math.round(srcY * scaleFactor),
          tileCanvas.width, tileCanvas.height,
          0, 0, tileCanvas.width, tileCanvas.height
        );

        const tileData = tileCanvas.toDataURL('image/png');
        const tileInfo = `Tile ${tx + 1}/${tilesX} across, ${ty + 1}/${tilesY} down`;
        addPageHeader(pdf, title, pageNum, totalPages, tileInfo);

        pdf.addImage(tileData, 'PNG', MARGIN, MARGIN, srcW, srcH);

        pdf.setDrawColor(0);
        pdf.setLineWidth(0.02);
        pdf.rect(MARGIN, MARGIN, srcW, srcH);
        addRegistrationMarks(pdf, MARGIN, MARGIN, srcW, srcH);

        pdf.setFontSize(7);
        pdf.setTextColor(120);
        if (tx < tilesX - 1) pdf.text('→ continues right', MARGIN + srcW - 0.05, MARGIN + srcH / 2, { angle: 90, align: 'center' });
        if (ty < tilesY - 1) pdf.text('↓ continues below', MARGIN + srcW / 2, MARGIN + srcH + 0.15, { align: 'center' });
        pdf.setTextColor(0);

        addScaleBar(pdf, MARGIN, MARGIN + srcH + 0.2);

        pdf.setFontSize(7);
        pdf.text(
          `Art position: ${srcX.toFixed(2)}" from left, ${srcY.toFixed(2)}" from top`,
          PAGE_W / 2, PAGE_H - 0.25,
          { align: 'center' }
        );
      }
    }
  }

  pdf.save(filename);
}

export function exportPNG(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportSVG(svgString, filename) {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Piece Template PDF ───────────────────────────────────────────────────────
// Generates a PDF with:
//   Page 1 — Color legend + piece list
//   Page 2+ — Individual piece cut templates at 1:1 scale (came-inset size)

function piecePolyArea(contour) {
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    area += contour[i][0] * contour[j][1] - contour[j][0] * contour[i][1];
  }
  return area / 2;
}

export async function exportPieceTemplates(polygonRegions, palette, colorLetters, settings, pxW) {
  const { width, height, units, cameWidth = 0.1875 } = settings;
  const artWIn = units === 'in' ? parseFloat(width) : parseFloat(width) / 2.54;
  const artHIn = units === 'in' ? parseFloat(height) : parseFloat(height) / 2.54;
  const pxToIn = artWIn / pxW;

  // Build piece data from inset contours
  const pieces = polygonRegions
    .filter(r => r.insetContours && r.insetContours.length > 0)
    .map(r => {
      const mainContour = r.insetContours.reduce((best, c) =>
        Math.abs(piecePolyArea(c)) > Math.abs(piecePolyArea(best)) ? c : best
      );
      const xs = mainContour.map(p => p[0]);
      const ys = mainContour.map(p => p[1]);
      const bboxX = Math.min(...xs);
      const bboxY = Math.min(...ys);
      const bboxWIn = (Math.max(...xs) - bboxX) * pxToIn;
      const bboxHIn = (Math.max(...ys) - bboxY) * pxToIn;
      const areaIn = Math.abs(piecePolyArea(mainContour)) * pxToIn * pxToIn;
      return { ...r, mainContour, bboxX, bboxY, bboxWIn, bboxHIn, areaIn };
    })
    .sort((a, b) => a.pieceNumber - b.pieceNumber);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  // ── Page 1: Legend ────────────────────────────────────────────────────────
  pdf.setFontSize(13);
  pdf.setFont(undefined, 'bold');
  pdf.text('Stained Glass — Color Legend & Piece List', PAGE_W / 2, MARGIN, { align: 'center' });
  pdf.setFont(undefined, 'normal');

  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(
    `${artWIn.toFixed(1)}" × ${artHIn.toFixed(1)}" • ${pieces.length} pieces • Came heart: ${cameWidth}" • Templates at actual cut size`,
    PAGE_W / 2, MARGIN + 0.2, { align: 'center' }
  );
  pdf.setTextColor(0);

  // Group pieces by color
  const byColor = {};
  for (const piece of pieces) {
    const ci = piece.colorIdx;
    if (!byColor[ci]) byColor[ci] = { pieces: [], letter: colorLetters[ci] || String.fromCharCode(65 + ci) };
    byColor[ci].pieces.push(piece);
  }

  let legendY = MARGIN + 0.5;
  for (const [ci, group] of Object.entries(byColor)) {
    const [r, g, b] = palette[parseInt(ci)];
    const totalArea = group.pieces.reduce((s, p) => s + p.areaIn, 0);

    // Color swatch
    pdf.setFillColor(r, g, b);
    pdf.setDrawColor(60, 60, 60);
    pdf.setLineWidth(0.01);
    pdf.rect(MARGIN, legendY - 0.18, 0.32, 0.26, 'FD');

    // Color letter + stats
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Color ${group.letter}`, MARGIN + 0.42, legendY);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(9);
    pdf.text(
      `${group.pieces.length} piece${group.pieces.length !== 1 ? 's' : ''} — ${totalArea.toFixed(1)} sq in (${(totalArea / 144).toFixed(3)} sq ft)`,
      MARGIN + 1.0, legendY
    );

    // Piece numbers for this color
    const nums = group.pieces.map(p => `#${p.pieceNumber}`).join(', ');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100);
    pdf.text(`Pieces: ${nums}`, MARGIN + 0.42, legendY + 0.17);
    pdf.setTextColor(0);

    legendY += 0.5;
    if (legendY > PAGE_H - MARGIN - 1.0) {
      pdf.addPage();
      legendY = MARGIN + 0.3;
    }
  }

  // Footer note on legend page
  pdf.setFontSize(7.5);
  pdf.setTextColor(80);
  pdf.text(
    `Templates account for ${cameWidth}" came heart — each piece is inset ${(cameWidth / 2).toFixed(4)}" per edge from the pattern line.`,
    MARGIN, PAGE_H - MARGIN - 0.18
  );
  pdf.text(
    'Print at exactly 100% scale. Trace outline onto glass or use as a cardboard scoring guide.',
    MARGIN, PAGE_H - MARGIN
  );
  pdf.setTextColor(0);

  // ── Pages 2+: Piece templates ─────────────────────────────────────────────
  pdf.addPage();

  const PIECE_PAD = 0.25;   // gap between pieces on a page
  const LABEL_H = 0.4;       // height reserved below each piece for label

  let pageX = MARGIN;
  let pageY = MARGIN;
  let rowH = 0;

  for (const piece of pieces) {
    // Determine if piece needs to be scaled down to fit the page
    let scale = 1.0;
    if (piece.bboxWIn > PRINT_W || piece.bboxHIn > PRINT_H - LABEL_H) {
      scale = Math.min(PRINT_W / piece.bboxWIn, (PRINT_H - LABEL_H) / piece.bboxHIn) * 0.9;
    }

    const scaledW = piece.bboxWIn * scale;
    const scaledH = piece.bboxHIn * scale + LABEL_H;

    // Move to next row if this piece doesn't fit horizontally
    if (pageX > MARGIN && pageX + scaledW > PAGE_W - MARGIN) {
      pageX = MARGIN;
      pageY += rowH + PIECE_PAD;
      rowH = 0;
    }

    // New page if not enough vertical space
    if (pageY + scaledH > PAGE_H - MARGIN) {
      pdf.addPage();
      pageX = MARGIN;
      pageY = MARGIN;
      rowH = 0;
    }

    // ── Draw the piece polygon ──────────────────────────────────────────────
    const [r, g, b] = palette[piece.colorIdx];
    pdf.setFillColor(r, g, b);
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.018);

    const contour = piece.mainContour;
    const ox = piece.bboxX;
    const oy = piece.bboxY;
    const s = pxToIn * scale;  // pixels → inches, with page scaling

    // Build relative line segments for jsPDF.lines() (each segment is [dx, dy])
    const lineSegs = [];
    for (let i = 1; i < contour.length; i++) {
      lineSegs.push([
        (contour[i][0] - contour[i - 1][0]) * s,
        (contour[i][1] - contour[i - 1][1]) * s,
      ]);
    }

    const startX = pageX + (contour[0][0] - ox) * s;
    const startY = pageY + (contour[0][1] - oy) * s;

    pdf.lines(lineSegs, startX, startY, [1, 1], 'FD', true);

    // ── Piece label below the piece ────────────────────────────────────────
    const labelBaseY = pageY + piece.bboxHIn * scale + 0.22;

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text(`#${piece.pieceNumber}`, pageX, labelBaseY);
    pdf.setFont(undefined, 'normal');

    // Color swatch inline
    pdf.setFillColor(r, g, b);
    pdf.setDrawColor(60, 60, 60);
    pdf.setLineWidth(0.01);
    pdf.rect(pageX + 0.22, labelBaseY - 0.12, 0.16, 0.14, 'FD');

    pdf.setFontSize(7.5);
    const colorLetter = colorLetters[piece.colorIdx] || String.fromCharCode(65 + piece.colorIdx);
    const scaleNote = scale < 0.999 ? ` (${Math.round(scale * 100)}%)` : '';
    pdf.text(
      `Color ${colorLetter}  ${piece.bboxWIn.toFixed(2)}" × ${piece.bboxHIn.toFixed(2)}"${scaleNote}`,
      pageX + 0.42, labelBaseY
    );

    pageX += scaledW + PIECE_PAD;
    rowH = Math.max(rowH, scaledH);
  }

  pdf.save('stained-glass-piece-templates.pdf');
}
