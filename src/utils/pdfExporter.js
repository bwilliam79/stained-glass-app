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
  // Corners
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  for (const [cx, cy] of corners) {
    pdf.line(cx - markSize, cy, cx + markSize, cy);
    pdf.line(cx, cy - markSize, cx, cy + markSize);
  }
  pdf.setDrawColor(0);
}

function addScaleBar(pdf, x, y, dpi) {
  // Draw a 1-inch scale bar
  const barW = 1; // inch
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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  // Check if art fits on a single page
  if (artWIn <= PRINT_W && artHIn <= PRINT_H) {
    // Single page
    const imgData = canvas.toDataURL('image/png');
    const xOff = MARGIN + (PRINT_W - artWIn) / 2;
    const yOff = MARGIN + (PRINT_H - artHIn) / 2;

    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, PAGE_W / 2, MARGIN - 0.15, { align: 'center' });
    pdf.setFont(undefined, 'normal');

    pdf.addImage(imgData, 'PNG', xOff, yOff, artWIn, artHIn);

    // Border
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.02);
    pdf.rect(xOff, yOff, artWIn, artHIn);

    // Scale bar
    addScaleBar(pdf, xOff, yOff + artHIn + 0.2, 96);

    // Dimensions label
    pdf.setFontSize(8);
    pdf.text(`${artWIn}" × ${artHIn}"`, PAGE_W / 2, yOff + artHIn + 0.35, { align: 'center' });

  } else {
    // Tiled pages
    const tilesX = Math.ceil(artWIn / PRINT_W);
    const tilesY = Math.ceil(artHIn / PRINT_H);
    const totalPages = tilesX * tilesY;
    let pageNum = 0;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        pageNum++;
        if (pageNum > 1) pdf.addPage();

        // Source rect on the art (in inches)
        const srcX = tx * PRINT_W;
        const srcY = ty * PRINT_H;
        const srcW = Math.min(PRINT_W, artWIn - srcX);
        const srcH = Math.min(PRINT_H, artHIn - srcY);

        // Crop canvas to this tile
        const tileCanvas = document.createElement('canvas');
        const scaleFactor = canvas.width / artWIn;
        tileCanvas.width = Math.round(srcW * scaleFactor);
        tileCanvas.height = Math.round(srcH * scaleFactor);
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

        // Border + registration marks
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.02);
        pdf.rect(MARGIN, MARGIN, srcW, srcH);
        addRegistrationMarks(pdf, MARGIN, MARGIN, srcW, srcH);

        // Overlap guide
        pdf.setFontSize(7);
        pdf.setTextColor(120);
        if (tx < tilesX - 1) pdf.text('→ continues right', MARGIN + srcW - 0.05, MARGIN + srcH / 2, { angle: 90, align: 'center' });
        if (ty < tilesY - 1) pdf.text('↓ continues below', MARGIN + srcW / 2, MARGIN + srcH + 0.15, { align: 'center' });
        pdf.setTextColor(0);

        // Scale bar on each tile
        addScaleBar(pdf, MARGIN, MARGIN + srcH + 0.2, 96);

        // Position label
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
