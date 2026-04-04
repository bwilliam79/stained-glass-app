// ─── K-Means Color Quantization ───────────────────────────────────────────────

function colorDistSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function initKMeansPP(samples, k) {
  const centroids = [samples[Math.floor(Math.random() * samples.length)]];
  while (centroids.length < k) {
    const dists = samples.map(p => Math.min(...centroids.map(c => colorDistSq(p, c))));
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { centroids.push(samples[i]); break; }
    }
    if (centroids.length < k) centroids.push(samples[samples.length - 1]);
  }
  return centroids.map(c => [...c]);
}

function kMeansQuantize(data, numPixels, k) {
  const sampleRate = Math.max(1, Math.floor(numPixels / 8000));
  const samples = [];
  for (let i = 0; i < numPixels; i += sampleRate) {
    const idx = i * 4;
    if (data[idx + 3] > 127) {
      samples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }
  if (samples.length === 0) return [[128, 128, 128]];

  let centroids = initKMeansPP(samples, Math.min(k, samples.length));
  const n = centroids.length;
  const assignments = new Int32Array(samples.length);

  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < n; j++) {
        const d = colorDistSq(samples[i], centroids[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    const sums = Array.from({ length: n }, () => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      const c = assignments[i];
      sums[c][0] += samples[i][0];
      sums[c][1] += samples[i][1];
      sums[c][2] += samples[i][2];
      sums[c][3]++;
    }
    for (let j = 0; j < n; j++) {
      if (sums[j][3] > 0) {
        centroids[j] = [
          Math.round(sums[j][0] / sums[j][3]),
          Math.round(sums[j][1] / sums[j][3]),
          Math.round(sums[j][2] / sums[j][3]),
        ];
      }
    }
  }
  return centroids;
}

function applyPaletteToPixels(data, numPixels, palette) {
  const out = new Uint8ClampedArray(numPixels * 4);
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    let best = 0, bestD = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const d = colorDistSq([r, g, b], palette[j]);
      if (d < bestD) { bestD = d; best = j; }
    }
    out[idx] = palette[best][0];
    out[idx + 1] = palette[best][1];
    out[idx + 2] = palette[best][2];
    out[idx + 3] = 255;
  }
  return out;
}

// ─── Cell Grid ────────────────────────────────────────────────────────────────

function createCellGrid(quantPixels, pxW, pxH, gridW, gridH, cellSize, palette) {
  const grid = new Int32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const counts = new Int32Array(palette.length);
      const x0 = gx * cellSize;
      const y0 = gy * cellSize;
      const x1 = Math.min(x0 + cellSize, pxW);
      const y1 = Math.min(y0 + cellSize, pxH);
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * pxW + px) * 4;
          const r = quantPixels[idx], g = quantPixels[idx + 1], b = quantPixels[idx + 2];
          for (let p = 0; p < palette.length; p++) {
            if (palette[p][0] === r && palette[p][1] === g && palette[p][2] === b) {
              counts[p]++;
              break;
            }
          }
        }
      }
      let maxCount = 0, maxP = 0;
      for (let p = 0; p < palette.length; p++) {
        if (counts[p] > maxCount) { maxCount = counts[p]; maxP = p; }
      }
      grid[gy * gridW + gx] = maxP;
    }
  }
  return grid;
}

// ─── Connected Regions (4-connectivity flood fill) ────────────────────────────

function findConnectedRegions(grid, gridW, gridH) {
  const labels = new Int32Array(gridW * gridH).fill(-1);
  const regions = [];
  let nextLabel = 0;

  for (let i = 0; i < gridW * gridH; i++) {
    if (labels[i] >= 0) continue;
    const colorIdx = grid[i];
    const label = nextLabel++;
    const cells = [];
    const queue = [i];
    labels[i] = label;

    while (queue.length > 0) {
      const ci = queue.pop();
      cells.push(ci);
      const cx = ci % gridW;
      const cy = (ci - cx) / gridW;
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
          const ni = ny * gridW + nx;
          if (labels[ni] < 0 && grid[ni] === colorIdx) {
            labels[ni] = label;
            queue.push(ni);
          }
        }
      }
    }
    regions.push({ label, colorIdx, cells });
  }
  return { labels, regions };
}

// ─── Merge Small Regions ──────────────────────────────────────────────────────

function mergeSmallRegions(labels, regions, grid, gridW, gridH, minCells) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of regions) {
      if (region.cells.length === 0 || region.cells.length >= minCells) continue;

      const neighborCounts = {};
      for (const ci of region.cells) {
        const cx = ci % gridW;
        const cy = (ci - cx) / gridW;
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
            const ni = ny * gridW + nx;
            if (labels[ni] !== region.label) {
              neighborCounts[labels[ni]] = (neighborCounts[labels[ni]] || 0) + 1;
            }
          }
        }
      }

      let bestNeighbor = -1, bestCount = 0;
      for (const [nl, count] of Object.entries(neighborCounts)) {
        if (parseInt(count) > bestCount) {
          bestCount = parseInt(count);
          bestNeighbor = parseInt(nl);
        }
      }
      if (bestNeighbor < 0) continue;

      const target = regions.find(r => r.label === bestNeighbor);
      if (!target) continue;

      for (const ci of region.cells) {
        labels[ci] = bestNeighbor;
        grid[ci] = target.colorIdx;
        target.cells.push(ci);
      }
      region.cells = [];
      changed = true;
    }
  }
}

// ─── Contour Extraction ───────────────────────────────────────────────────────

function extractRegionContours(labels, gridW, gridH, regionLabel, cellSize, pxW, pxH) {
  // Collect boundary edge segments in grid coordinates
  const adj = new Map();

  function addEdge(x1, y1, x2, y2) {
    const k1 = `${x1},${y1}`;
    const k2 = `${x2},${y2}`;
    if (!adj.has(k1)) adj.set(k1, new Set());
    if (!adj.has(k2)) adj.set(k2, new Set());
    adj.get(k1).add(k2);
    adj.get(k2).add(k1);
  }

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      if (labels[gy * gridW + gx] !== regionLabel) continue;
      // Top edge
      if (gy === 0 || labels[(gy - 1) * gridW + gx] !== regionLabel) {
        addEdge(gx, gy, gx + 1, gy);
      }
      // Bottom edge
      if (gy === gridH - 1 || labels[(gy + 1) * gridW + gx] !== regionLabel) {
        addEdge(gx, gy + 1, gx + 1, gy + 1);
      }
      // Left edge
      if (gx === 0 || labels[gy * gridW + (gx - 1)] !== regionLabel) {
        addEdge(gx, gy, gx, gy + 1);
      }
      // Right edge
      if (gx === gridW - 1 || labels[gy * gridW + (gx + 1)] !== regionLabel) {
        addEdge(gx + 1, gy, gx + 1, gy + 1);
      }
    }
  }

  // Trace contours by following edges
  // For 4-connected regions, each boundary vertex has exactly 2 edges,
  // so traversal is unambiguous.
  const usedEdges = new Set();
  const contours = [];

  function edgeKey(k1, k2) {
    return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
  }

  for (const [startKey, neighbors] of adj) {
    for (const neighborKey of neighbors) {
      const ek = edgeKey(startKey, neighborKey);
      if (usedEdges.has(ek)) continue;

      const contour = [];
      let prevKey = null;
      let currKey = startKey;
      usedEdges.add(ek);
      contour.push(startKey.split(',').map(Number));

      let nextKey = neighborKey;
      let safety = 0;

      while (nextKey !== startKey && safety < 200000) {
        safety++;
        contour.push(nextKey.split(',').map(Number));
        const currNeighbors = adj.get(nextKey);
        let found = null;
        for (const nk of currNeighbors) {
          const nek = edgeKey(nextKey, nk);
          if (!usedEdges.has(nek)) {
            found = nk;
            usedEdges.add(nek);
            break;
          }
        }
        if (!found) break;
        prevKey = nextKey;
        nextKey = found;
      }

      if (contour.length >= 3) {
        // Convert grid coordinates to pixel coordinates
        const pxContour = contour.map(([gx, gy]) => [
          Math.min(gx * cellSize, pxW),
          Math.min(gy * cellSize, pxH),
        ]);
        contours.push(pxContour);
      }
    }
  }

  return contours;
}

// ─── Douglas-Peucker Simplification ──────────────────────────────────────────

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function douglasPeucker(points, tolerance) {
  // Iterative DP using a stack — avoids deep recursion and excessive array slicing
  const n = points.length;
  if (n <= 2) return points;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start <= 1) continue;

    let maxDist = 0, maxIdx = start;
    const x1 = points[start][0], y1 = points[start][1];
    const x2 = points[end][0], y2 = points[end][1];

    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentDist(points[i][0], points[i][1], x1, y1, x2, y2);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }

    if (maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function simplifyClosedContour(points, tolerance) {
  if (points.length <= 4) return points;

  // Find the two most distant points to use as split anchors
  let bestDist = 0, splitA = 0, splitB = 0;
  const step = Math.max(1, Math.floor(points.length / 50));
  for (let i = 0; i < points.length; i += step) {
    for (let j = i + Math.floor(points.length / 4); j < points.length; j += step) {
      const d = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
      if (d > bestDist) { bestDist = d; splitA = i; splitB = j; }
    }
  }

  // Split into two halves at the most distant points
  const half1 = points.slice(splitA, splitB + 1);
  const half2 = [...points.slice(splitB), ...points.slice(0, splitA + 1)];

  const s1 = douglasPeucker(half1, tolerance);
  const s2 = douglasPeucker(half2, tolerance);

  const result = [...s1.slice(0, -1), ...s2.slice(0, -1)];
  return result.length >= 3 ? result : points;
}

// ─── SVG Building ─────────────────────────────────────────────────────────────

function contourToSVGPath(contour) {
  if (contour.length < 3) return '';
  return `M ${contour[0][0]} ${contour[0][1]} ` +
    contour.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ') +
    ' Z';
}

function buildSVG(polygonRegions, palette, pxW, pxH, lineThickness, outlineOnly) {
  const strokeW = Math.max(1, lineThickness);
  let paths = '';

  // Draw a white background
  paths += `<rect x="0" y="0" width="${pxW}" height="${pxH}" fill="${outlineOnly ? 'white' : '#f5f5f5'}" />\n`;

  // Pass 1: Draw fills with a fill-colored stroke to eliminate anti-aliasing gaps
  // The slightly wider fill-colored stroke creates overlap between adjacent regions
  for (const region of polygonRegions) {
    const [r, g, b] = palette[region.colorIdx];
    const fill = outlineOnly ? 'white' : `rgb(${r},${g},${b})`;

    for (const contour of region.contours) {
      const d = contourToSVGPath(contour);
      if (d) {
        paths += `  <path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="${strokeW + 2}" stroke-linejoin="round" />\n`;
      }
    }
  }

  // Pass 2: Draw the visible outlines on top
  for (const region of polygonRegions) {
    for (const contour of region.contours) {
      const d = contourToSVGPath(contour);
      if (d) {
        paths += `  <path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="${strokeW}" stroke-linejoin="round" />\n`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">\n${paths}</svg>`;
}

// ─── SVG to Canvas ────────────────────────────────────────────────────────────

function svgToCanvas(svgString, width, height) {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: return empty canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      resolve(canvas);
    };
    img.src = url;
  });
}

// ─── Polygon-based Material Estimates ─────────────────────────────────────────

function polygonArea(contour) {
  // Shoelace formula (returns signed area)
  let area = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    area += contour[i][0] * contour[j][1];
    area -= contour[j][0] * contour[i][1];
  }
  return area / 2;
}

function polygonPerimeter(contour) {
  let perim = 0;
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length;
    perim += Math.hypot(contour[j][0] - contour[i][0], contour[j][1] - contour[i][1]);
  }
  return perim;
}

function calculatePolygonEstimates(polygonRegions, palette, settings, pxW, pxH, dpi) {
  const { wastePercent, units } = settings;
  const wasteFactor = 1 + (wastePercent || 15) / 100;
  const widthIn = units === 'in' ? settings.width : settings.width / 2.54;
  const heightIn = units === 'in' ? settings.height : settings.height / 2.54;
  const pxToIn = widthIn / pxW; // pixel to inch conversion
  const pxToInSq = pxToIn * pxToIn;

  const colorAreas = {};
  let totalInteriorPerimPx = 0;
  let pieceCount = 0;

  for (const region of polygonRegions) {
    const key = region.colorIdx;
    let regionAreaPx = 0;
    let regionPerimPx = 0;

    for (const contour of region.contours) {
      regionAreaPx += Math.abs(polygonArea(contour));
      regionPerimPx += polygonPerimeter(contour);
    }

    totalInteriorPerimPx += regionPerimPx;
    pieceCount++;

    if (!colorAreas[key]) colorAreas[key] = 0;
    colorAreas[key] += regionAreaPx;
  }

  const totalAreaIn = widthIn * heightIn;
  const perimeterIn = 2 * (widthIn + heightIn);

  const glassByColor = Object.entries(colorAreas)
    .map(([colorIdxStr, areaPx]) => {
      const colorIdx = parseInt(colorIdxStr);
      const [r, g, b] = palette[colorIdx];
      const areaIn = areaPx * pxToInSq * wasteFactor;
      const fraction = areaPx * pxToInSq / totalAreaIn;
      return { r, g, b, areaIn, areaSqFt: areaIn / 144, fraction };
    })
    .filter(c => c.areaIn > 0.5)
    .sort((a, b) => b.areaIn - a.areaIn);

  const totalGlassSqFt = glassByColor.reduce((s, c) => s + c.areaSqFt, 0);

  // Interior came: half the total perimeter of all polygons (each edge shared by 2 regions)
  // minus the outer perimeter which isn't shared
  const totalPerimIn = totalInteriorPerimPx * pxToIn;
  const interiorCameIn = (totalPerimIn - perimeterIn) / 2;
  const cameLengthIn = interiorCameIn + perimeterIn;
  const cameLengthFt = cameLengthIn / 12;
  const interiorCameFt = Math.max(0, interiorCameIn) / 12;
  const perimeterCameFt = perimeterIn / 12;

  const solderLbs = cameLengthFt / 8;

  return {
    glassTotal: { value: totalGlassSqFt.toFixed(2), unit: 'sq ft' },
    glassByColor,
    cameLength: { value: cameLengthFt.toFixed(1), unit: 'linear ft' },
    interiorCame: { value: interiorCameFt.toFixed(1), unit: 'linear ft' },
    perimeterCame: { value: perimeterCameFt.toFixed(1), unit: 'linear ft' },
    solderWeight: { value: solderLbs.toFixed(2), unit: 'lbs (50/50)' },
    totalArea: { value: totalAreaIn.toFixed(1), unit: 'sq in' },
    numPieces: pieceCount,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function processImage(imageFile, settings) {
  const { width, height, units, numColors, blurRadius, lineThickness } = settings;
  const DPI = 72;

  const pxW = Math.round((units === 'in' ? width : width / 2.54) * DPI);
  const pxH = Math.round((units === 'in' ? height : height / 2.54) * DPI);

  // 1. Load and blur image
  const bitmap = await createImageBitmap(imageFile);
  const workCanvas = document.createElement('canvas');
  workCanvas.width = pxW;
  workCanvas.height = pxH;
  const ctx = workCanvas.getContext('2d');
  const blurPx = Math.round(blurRadius * 2);
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(bitmap, 0, 0, pxW, pxH);
  ctx.filter = 'none';
  const blurredData = ctx.getImageData(0, 0, pxW, pxH);

  // 2. Quantize pixel colors
  const palette = kMeansQuantize(blurredData.data, pxW * pxH, numColors);
  const quantPixels = applyPaletteToPixels(blurredData.data, pxW * pxH, palette);

  // 3. Create cell grid — fine grid for good contour fidelity
  const cellSize = Math.max(2, Math.round(2 + blurRadius * 0.3));
  const gridW = Math.ceil(pxW / cellSize);
  const gridH = Math.ceil(pxH / cellSize);
  const grid = createCellGrid(quantPixels, pxW, pxH, gridW, gridH, cellSize, palette);

  // 4. Find connected regions via flood fill
  const { labels, regions } = findConnectedRegions(grid, gridW, gridH);

  // 5. Merge only truly tiny regions (noise fragments), preserve design features
  const minCells = Math.max(3, Math.round(5 + blurRadius * 1));
  mergeSmallRegions(labels, regions, grid, gridW, gridH, minCells);
  const activeRegions = regions.filter(r => r.cells.length > 0);

  // 6. Extract polygon contours — gentle DP simplification
  // Smooths staircase edges into straight lines while preserving shape detail
  const minDim = Math.min(pxW, pxH);
  const dpTolerance = minDim * (0.006 + blurRadius * 0.001);
  const polygonRegions = [];

  for (const region of activeRegions) {
    const contours = extractRegionContours(labels, gridW, gridH, region.label, cellSize, pxW, pxH);
    const simplified = contours.map(c => simplifyClosedContour(c, dpTolerance));
    polygonRegions.push({
      colorIdx: region.colorIdx,
      contours: simplified,
      cellCount: region.cells.length,
    });
  }

  // 7. Build SVG strings
  const svgColored = buildSVG(polygonRegions, palette, pxW, pxH, lineThickness, false);
  const svgOutline = buildSVG(polygonRegions, palette, pxW, pxH, lineThickness, true);

  // 8. Convert SVG to canvas for preview and PDF export
  const patternCanvas = await svgToCanvas(svgColored, pxW, pxH);
  const outlineCanvas = await svgToCanvas(svgOutline, pxW, pxH);

  // 9. Calculate material estimates from polygon geometry
  const estimates = calculatePolygonEstimates(polygonRegions, palette, settings, pxW, pxH, DPI);

  return {
    patternCanvas,
    outlineCanvas,
    svgColored,
    svgOutline,
    estimates,
    palette,
    pxW,
    pxH,
    DPI,
  };
}
