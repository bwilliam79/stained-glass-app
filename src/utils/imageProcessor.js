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
  // Sample pixels for performance
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
    // Assign
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bestD = Infinity;
      for (let j = 0; j < n; j++) {
        const d = colorDistSq(samples[i], centroids[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) break;

    // Update centroids
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

function applyPalette(data, numPixels, palette) {
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

// ─── Edge Detection & Dilation ────────────────────────────────────────────────

function detectEdges(quantPixels, width, height) {
  const edges = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = quantPixels[idx], g = quantPixels[idx + 1], b = quantPixels[idx + 2];
      // Check 4 neighbors
      const neighbors = [
        x > 0 ? (y * width + (x - 1)) * 4 : -1,
        x < width - 1 ? (y * width + (x + 1)) * 4 : -1,
        y > 0 ? ((y - 1) * width + x) * 4 : -1,
        y < height - 1 ? ((y + 1) * width + x) * 4 : -1,
      ];
      for (const nIdx of neighbors) {
        if (nIdx >= 0 && (quantPixels[nIdx] !== r || quantPixels[nIdx + 1] !== g || quantPixels[nIdx + 2] !== b)) {
          edges[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return edges;
}

function countRawEdgeSegments(quantPixels, width, height) {
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = quantPixels[idx], g = quantPixels[idx + 1], b = quantPixels[idx + 2];
      if (x < width - 1) {
        const ri = (y * width + x + 1) * 4;
        if (quantPixels[ri] !== r || quantPixels[ri + 1] !== g || quantPixels[ri + 2] !== b) count++;
      }
      if (y < height - 1) {
        const bi = ((y + 1) * width + x) * 4;
        if (quantPixels[bi] !== r || quantPixels[bi + 1] !== g || quantPixels[bi + 2] !== b) count++;
      }
    }
  }
  return count;
}

function dilateEdges(edges, width, height, thickness) {
  const result = new Uint8Array(width * height);
  const r = Math.floor(thickness / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x]) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r * r) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                result[ny * width + nx] = 1;
              }
            }
          }
        }
      }
    }
  }
  return result;
}

// ─── Canvas Building ──────────────────────────────────────────────────────────

function buildPatternCanvas(quantPixels, thickEdges, width, height, outlineOnly) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    if (thickEdges[i]) {
      imgData.data[idx] = 20;
      imgData.data[idx + 1] = 20;
      imgData.data[idx + 2] = 20;
      imgData.data[idx + 3] = 255;
    } else if (outlineOnly) {
      imgData.data[idx] = 255;
      imgData.data[idx + 1] = 255;
      imgData.data[idx + 2] = 255;
      imgData.data[idx + 3] = 255;
    } else {
      imgData.data[idx] = quantPixels[idx];
      imgData.data[idx + 1] = quantPixels[idx + 1];
      imgData.data[idx + 2] = quantPixels[idx + 2];
      imgData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// ─── Material Estimates ───────────────────────────────────────────────────────

function calculateEstimates(quantPixels, thickEdges, palette, width, height, settings, dpi) {
  const { wastePercent, units } = settings;
  const totalPixels = width * height;
  const wasteFactor = 1 + (wastePercent || 15) / 100;

  // Area in square inches
  const widthIn = units === 'in' ? settings.width : settings.width / 2.54;
  const heightIn = units === 'in' ? settings.height : settings.height / 2.54;
  const totalAreaIn = widthIn * heightIn;

  // Count non-edge pixels per palette color
  const colorCounts = new Array(palette.length).fill(0);
  let nonEdgeTotal = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (!thickEdges[i]) {
      const idx = i * 4;
      const r = quantPixels[idx], g = quantPixels[idx + 1], b = quantPixels[idx + 2];
      let best = 0, bestD = Infinity;
      for (let j = 0; j < palette.length; j++) {
        const d = colorDistSq([r, g, b], palette[j]);
        if (d < bestD) { bestD = d; best = j; }
      }
      colorCounts[best]++;
      nonEdgeTotal++;
    }
  }

  const glassByColor = palette.map(([r, g, b], i) => {
    const fraction = nonEdgeTotal > 0 ? colorCounts[i] / nonEdgeTotal : 0;
    const areaIn = fraction * totalAreaIn * wasteFactor;
    return { r, g, b, areaIn, areaSqFt: areaIn / 144, fraction };
  }).filter(c => c.areaIn > 0.5).sort((a, b) => b.areaIn - a.areaIn);

  const totalGlassSqFt = glassByColor.reduce((s, c) => s + c.areaSqFt, 0);

  // Came length: count edge boundary segments
  const boundarySegments = countRawEdgeSegments(quantPixels, width, height);
  // Add perimeter
  const perimeterIn = 2 * (widthIn + heightIn);
  const cameLengthIn = (boundarySegments / dpi) + perimeterIn;
  const cameLengthFt = cameLengthIn / 12;

  // Solder: ~1 lb per 8 linear feet of came
  const solderLbs = cameLengthFt / 8;

  // Came: U-channel for perimeter, H-channel for interior
  const interiorCameFt = (cameLengthIn - perimeterIn) / 12;
  const perimeterCameFt = perimeterIn / 12;

  return {
    glassTotal: { value: totalGlassSqFt.toFixed(2), unit: 'sq ft' },
    glassByColor,
    cameLength: { value: cameLengthFt.toFixed(1), unit: 'linear ft' },
    interiorCame: { value: interiorCameFt.toFixed(1), unit: 'linear ft' },
    perimeterCame: { value: perimeterCameFt.toFixed(1), unit: 'linear ft' },
    solderWeight: { value: solderLbs.toFixed(2), unit: 'lbs (50/50)' },
    totalArea: { value: totalAreaIn.toFixed(1), unit: 'sq in' },
    numPieces: glassByColor.length,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function processImage(imageFile, settings) {
  const { width, height, units, numColors, blurRadius, lineThickness } = settings;
  const DPI = 72;

  const pxW = Math.round((units === 'in' ? width : width / 2.54) * DPI);
  const pxH = Math.round((units === 'in' ? height : height / 2.54) * DPI);

  // Load image
  const bitmap = await createImageBitmap(imageFile);

  // Draw with blur using canvas filter (GPU-accelerated)
  const workCanvas = document.createElement('canvas');
  workCanvas.width = pxW;
  workCanvas.height = pxH;
  const ctx = workCanvas.getContext('2d');

  const blurPx = Math.round(blurRadius * 6);
  if (blurPx > 0) {
    ctx.filter = `blur(${blurPx}px)`;
  }
  ctx.drawImage(bitmap, 0, 0, pxW, pxH);
  ctx.filter = 'none';

  const blurredData = ctx.getImageData(0, 0, pxW, pxH);

  // Quantize colors
  const palette = kMeansQuantize(blurredData.data, pxW * pxH, numColors);

  // Apply palette to every pixel
  const quantPixels = applyPalette(blurredData.data, pxW * pxH, palette);

  // Edge detection + dilation
  const rawEdges = detectEdges(quantPixels, pxW, pxH);
  const thickEdges = lineThickness > 1
    ? dilateEdges(rawEdges, pxW, pxH, lineThickness)
    : rawEdges;

  // Build output canvases
  const patternCanvas = buildPatternCanvas(quantPixels, thickEdges, pxW, pxH, false);
  const outlineCanvas = buildPatternCanvas(quantPixels, thickEdges, pxW, pxH, true);

  // Material estimates
  const estimates = calculateEstimates(quantPixels, thickEdges, palette, pxW, pxH, settings, DPI);

  return { patternCanvas, outlineCanvas, estimates, palette, pxW, pxH, DPI };
}
