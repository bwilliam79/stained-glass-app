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
  if (samples.length === 0) {
    console.warn('kMeansQuantize: no opaque samples found; returning gray fallback palette.');
    return [[128, 128, 128]];
  }

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
    // BFS via an index pointer: avoids the array-length ceiling that DFS can
    // hit on very large uniform regions and keeps shift amortized O(1).
    const queue = [i];
    let qHead = 0;
    labels[i] = label;

    while (qHead < queue.length) {
      const ci = queue[qHead++];
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
        const c = parseInt(count);
        const lbl = parseInt(nl);
        if (Number.isFinite(c) && Number.isFinite(lbl) && c > bestCount) {
          bestCount = c;
          bestNeighbor = lbl;
        }
      }
      // Defensive: if no valid neighbor was found, skip rather than dereference
      // a missing target below.
      if (bestNeighbor < 0) continue;

      const target = regions.find(r => r.label === bestNeighbor);
      if (!target || target.colorIdx == null) continue;

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

// ─── Eliminate Thin / Elongated Regions ──────────────────────────────────────
// Uses PCA on grid cell coordinates to find approximate minimum width.
// For a region of uniform width W cells, PCA gives approxMinWidth ≈ 0.577 * W.
// We eliminate regions where the actual minimum width (in pixels) < minCutWidthPx.

function eliminateThinRegions(labels, regions, grid, gridW, gridH, cellSize, minCutWidthPx) {
  // Convert minCutWidthPx to PCA threshold in cell units
  // approxMinWidth (cells) < minCutWidthPx * 0.577 / cellSize → too thin
  const pcaThreshold = minCutWidthPx * 0.577 / cellSize;

  let changed = true;
  while (changed) {
    changed = false;
    for (const region of regions) {
      if (region.cells.length < 4) continue;

      // Compute PCA minimum width
      const n = region.cells.length;
      const xs = region.cells.map(ci => ci % gridW);
      const ys = region.cells.map(ci => Math.floor(ci / gridW));

      let sumX = 0, sumY = 0;
      for (let i = 0; i < n; i++) { sumX += xs[i]; sumY += ys[i]; }
      const mx = sumX / n, my = sumY / n;

      let cxx = 0, cyy = 0, cxy = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx, dy = ys[i] - my;
        cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
      }
      cxx /= n; cyy /= n; cxy /= n;

      const trace = cxx + cyy;
      const det = cxx * cyy - cxy * cxy;
      const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
      const minEig = Math.max(0, trace / 2 - disc);
      const approxMinWidth = Math.sqrt(minEig) * 2; // in cell units

      if (approxMinWidth >= pcaThreshold) continue;

      // Too thin — merge with largest neighbor
      const neighborCounts = {};
      for (const ci of region.cells) {
        const cx = ci % gridW;
        const cy = Math.floor(ci / gridW);
        for (const [nx, ny] of [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]]) {
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
      if (gy === 0 || labels[(gy - 1) * gridW + gx] !== regionLabel) addEdge(gx, gy, gx + 1, gy);
      if (gy === gridH - 1 || labels[(gy + 1) * gridW + gx] !== regionLabel) addEdge(gx, gy + 1, gx + 1, gy + 1);
      if (gx === 0 || labels[gy * gridW + (gx - 1)] !== regionLabel) addEdge(gx, gy, gx, gy + 1);
      if (gx === gridW - 1 || labels[gy * gridW + (gx + 1)] !== regionLabel) addEdge(gx + 1, gy, gx + 1, gy + 1);
    }
  }

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
        nextKey = found;
      }

      if (contour.length >= 3) {
        // Map grid vertices back to pixel space. Clamp to the image rectangle
        // since the last row/column of cells can extend beyond pxW/pxH when
        // pxW/pxH is not an integer multiple of cellSize.
        const mapped = contour.map(([gx, gy]) => [
          Math.min(gx * cellSize, pxW),
          Math.min(gy * cellSize, pxH),
        ]);
        // Drop consecutive duplicates created by the clamp — they produce
        // zero-length edges that break downstream simplification/inset math.
        const pxContour = [];
        for (let i = 0; i < mapped.length; i++) {
          const prev = pxContour[pxContour.length - 1];
          if (!prev || prev[0] !== mapped[i][0] || prev[1] !== mapped[i][1]) {
            pxContour.push(mapped[i]);
          }
        }
        // Remove trailing duplicate of the first vertex (closed polygon).
        if (
          pxContour.length >= 2 &&
          pxContour[0][0] === pxContour[pxContour.length - 1][0] &&
          pxContour[0][1] === pxContour[pxContour.length - 1][1]
        ) {
          pxContour.pop();
        }
        if (pxContour.length >= 3) contours.push(pxContour);
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
  // Too short to simplify usefully — return a defensive copy so downstream
  // mutation (fixAcuteAngles, insetPolygon, etc.) can't alias the input.
  if (points.length <= 4) return points.slice();

  // Seed splits so they are always defined, even if the search below doesn't
  // find a pair with bestDist > 0 (e.g. a degenerate all-coincident contour).
  let bestDist = 0;
  let splitA = 0;
  let splitB = Math.floor(points.length / 2);
  const step = Math.max(1, Math.floor(points.length / 50));
  for (let i = 0; i < points.length; i += step) {
    for (let j = i + Math.floor(points.length / 4); j < points.length; j += step) {
      const d = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
      if (d > bestDist) { bestDist = d; splitA = i; splitB = j; }
    }
  }

  // If we never found any spread between candidate splits, simplification
  // can't do better than the original. Return a copy to keep callers safe.
  if (bestDist === 0) return points.slice();

  const half1 = points.slice(splitA, splitB + 1);
  const half2 = [...points.slice(splitB), ...points.slice(0, splitA + 1)];

  const s1 = douglasPeucker(half1, tolerance);
  const s2 = douglasPeucker(half2, tolerance);

  const result = [...s1.slice(0, -1), ...s2.slice(0, -1)];
  return result.length >= 3 ? result : points.slice();
}

// ─── Fix Acute Angles ─────────────────────────────────────────────────────────
// Bevels any polygon vertex with an interior angle < minAngleDeg by replacing
// the sharp point with a short flat edge. Sharp points crack when scored on glass.

function fixAcuteAngles(points, minAngleDeg) {
  if (points.length <= 3) return points;
  const minAngleRad = minAngleDeg * Math.PI / 180;
  const n = points.length;
  const result = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const dx1 = prev[0] - curr[0], dy1 = prev[1] - curr[1];
    const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
    const len1 = Math.hypot(dx1, dy1);
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 0.001 || len2 < 0.001) { result.push(curr); continue; }

    const cosAngle = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    if (angle < minAngleRad) {
      // Replace sharp vertex with two bevel points
      const bevelDist = Math.min(len1, len2) * 0.35;
      result.push([curr[0] + (dx1 / len1) * bevelDist, curr[1] + (dy1 / len1) * bevelDist]);
      result.push([curr[0] + (dx2 / len2) * bevelDist, curr[1] + (dy2 / len2) * bevelDist]);
    } else {
      result.push(curr);
    }
  }

  return result.length >= 3 ? result : points;
}

// ─── Polygon Inset (Came Compensation) ───────────────────────────────────────
// Each glass piece must be cut slightly smaller than the pattern to account for
// the lead came heart occupying space between pieces.
// Inset = came_heart_width / 2 per edge.

function lineIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.001) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

function insetPolygon(points, insetPx) {
  if (insetPx <= 0 || points.length < 3) return points;

  // Determine winding via signed area (SVG y-down coords)
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  // Positive area (y-down) = CW winding; inward normal = right of edge direction
  const sign = area >= 0 ? 1 : -1;

  // Offset each edge inward
  const offsetEdges = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j][0] - points[i][0];
    const dy = points[j][1] - points[i][1];
    const len = Math.hypot(dx, dy);
    if (len < 0.001) continue;
    const nx = sign * dy / len;
    const ny = -sign * dx / len;
    offsetEdges.push([
      points[i][0] + nx * insetPx, points[i][1] + ny * insetPx,
      points[j][0] + nx * insetPx, points[j][1] + ny * insetPx,
    ]);
  }
  if (offsetEdges.length < 3) return points;

  // Find intersections of consecutive offset edges to get new vertices
  const result = [];
  for (let i = 0; i < offsetEdges.length; i++) {
    const e1 = offsetEdges[i];
    const e2 = offsetEdges[(i + 1) % offsetEdges.length];
    const p = lineIntersect(e1[0], e1[1], e1[2], e1[3], e2[0], e2[1], e2[2], e2[3]);
    result.push(p || [e1[2], e1[3]]);
  }

  // Validate: if winding flipped or polygon collapsed, return original
  let newArea = 0;
  for (let i = 0; i < result.length; i++) {
    const j = (i + 1) % result.length;
    newArea += result[i][0] * result[j][1] - result[j][0] * result[i][1];
  }
  if (result.length < 3 || newArea * area < 0 || Math.abs(newArea) < Math.abs(area) * 0.1) {
    return points;
  }

  return result;
}

// ─── Polygon Centroid ─────────────────────────────────────────────────────────

function polygonCentroid(contour) {
  let cx = 0, cy = 0, area = 0;
  const n = contour.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = contour[i][0] * contour[j][1] - contour[j][0] * contour[i][1];
    cx += (contour[i][0] + contour[j][0]) * cross;
    cy += (contour[i][1] + contour[j][1]) * cross;
    area += cross;
  }
  if (Math.abs(area) < 0.001) {
    return [
      contour.reduce((s, p) => s + p[0], 0) / n,
      contour.reduce((s, p) => s + p[1], 0) / n,
    ];
  }
  return [cx / (3 * area), cy / (3 * area)];
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

  paths += `<rect x="0" y="0" width="${pxW}" height="${pxH}" fill="${outlineOnly ? 'white' : '#f5f5f5'}" />\n`;

  // Pass 1: Fill with fill-colored stroke to eliminate anti-aliasing gaps
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

  // Pass 2: Draw outlines on top
  for (const region of polygonRegions) {
    for (const contour of region.contours) {
      const d = contourToSVGPath(contour);
      if (d) {
        paths += `  <path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="${strokeW}" stroke-linejoin="round" />\n`;
      }
    }
  }

  // Pass 3: Piece number labels at centroids
  for (const region of polygonRegions) {
    if (!region.centroid || !region.pieceNumber) continue;
    const [cx, cy] = region.centroid;
    const area = region.contours.reduce((s, c) => s + Math.abs(polygonArea(c)), 0);
    const fontSize = Math.max(8, Math.min(20, Math.sqrt(area) / 6));
    paths += `  <text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" ` +
      `text-anchor="middle" dominant-baseline="central" ` +
      `font-family="Arial,Helvetica,sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="bold" ` +
      `fill="white" stroke="#1a1a1a" stroke-width="2.5" paint-order="stroke">${region.pieceNumber}</text>\n`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}">\n${paths}</svg>`;
}

// ─── SVG to Canvas ────────────────────────────────────────────────────────────

function svgToCanvas(svgString, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };

    // If the SVG never decodes (malformed, huge, sandbox refusal, etc.) we
    // must not hang the caller forever. 10s is well beyond normal decode.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('svgToCanvas: timed out after 10s decoding SVG.'));
    }, 10000);

    img.onload = () => {
      if (settled) return;
      settled = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        cleanup();
        resolve(canvas);
      } catch (err) {
        cleanup();
        reject(new Error(`svgToCanvas: drawImage failed — ${err && err.message ? err.message : err}`));
      }
    };

    img.onerror = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      const detail = err && err.message ? err.message : 'image failed to decode';
      reject(new Error(`svgToCanvas: ${detail}`));
    };

    img.src = url;
  });
}

// ─── Polygon-based Material Estimates ─────────────────────────────────────────

function polygonArea(contour) {
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

function calculatePolygonEstimates(polygonRegions, palette, colorLetters, settings, pxW, pxH) {
  const { wastePercent, units } = settings;
  const wasteFactor = 1 + (wastePercent || 15) / 100;
  const widthIn = units === 'in' ? settings.width : settings.width / 2.54;
  const heightIn = units === 'in' ? settings.height : settings.height / 2.54;
  const pxToIn = widthIn / pxW;
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
      const colorLetter = colorLetters[colorIdx] || String.fromCharCode(65 + colorIdx);
      return { r, g, b, areaIn, areaSqFt: areaIn / 144, fraction, colorLetter };
    })
    .filter(c => c.areaIn > 0.5)
    .sort((a, b) => b.areaIn - a.areaIn);

  const totalGlassSqFt = glassByColor.reduce((s, c) => s + c.areaSqFt, 0);

  const totalPerimIn = totalInteriorPerimPx * pxToIn;
  // Interior came estimate.
  //
  // ASSUMPTION: no holes — i.e. every region is a simple (possibly concave)
  // polygon with a single outer boundary and no inner boundaries. We sum all
  // contour perimeters, subtract the overall rectangle perimeter, then halve
  // the remainder because every interior edge is shared by exactly two pieces
  // and was therefore counted twice.
  //
  // This overestimates came length when a region has holes: a hole contributes
  // its perimeter once per piece instead of twice (it's shared with the
  // neighbouring region on only one side). The current contour extractor
  // emits each region's outer boundary and any interior boundaries
  // undistinguished, so we cannot separate them here without a hierarchy
  // pass. Until hole detection lands, treat this figure as an upper bound
  // for any pattern containing ring-shaped regions.
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
  const cameWidth = settings.cameWidth !== undefined ? settings.cameWidth : 0.1875;
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

  // 3. Create cell grid
  const cellSize = Math.max(2, Math.round(2 + blurRadius * 0.3));
  const gridW = Math.ceil(pxW / cellSize);
  const gridH = Math.ceil(pxH / cellSize);
  const grid = createCellGrid(quantPixels, pxW, pxH, gridW, gridH, cellSize, palette);

  // 4. Find connected regions via flood fill
  const { labels, regions } = findConnectedRegions(grid, gridW, gridH);

  // 5. Merge tiny noise fragments
  const minCells = Math.max(3, Math.round(5 + blurRadius * 1));
  mergeSmallRegions(labels, regions, grid, gridW, gridH, minCells);

  // 6. Eliminate thin/elongated regions that can't be cut in glass
  const minCutWidthPx = 0.375 * DPI; // 0.375" minimum cuttable width
  eliminateThinRegions(labels, regions, grid, gridW, gridH, cellSize, minCutWidthPx);

  const activeRegions = regions.filter(r => r.cells.length > 0);

  // 7. Extract contours, simplify, fix acute angles, compute insets + centroids
  const minDim = Math.min(pxW, pxH);
  const dpTolerance = minDim * (0.006 + blurRadius * 0.001);
  const cameInsetPx = (cameWidth / 2) * DPI; // half the came heart width in pixels

  const polygonRegions = [];

  for (const region of activeRegions) {
    const contours = extractRegionContours(labels, gridW, gridH, region.label, cellSize, pxW, pxH);
    if (contours.length === 0) continue;

    // DP simplify → fix acute angles
    const simplified = contours.map(c => {
      const dp = simplifyClosedContour(c, dpTolerance);
      return fixAcuteAngles(dp, 30); // bevel any angle < 30°
    });

    // Came compensation: inset each contour by half the came heart width
    const insetContours = simplified.map(c => insetPolygon(c, cameInsetPx));

    // Centroid of the largest (main) contour for piece labeling
    const mainContour = simplified.reduce((best, c) =>
      Math.abs(polygonArea(c)) > Math.abs(polygonArea(best)) ? c : best
    );
    const centroid = mainContour.length >= 3 ? polygonCentroid(mainContour) : null;

    polygonRegions.push({
      colorIdx: region.colorIdx,
      contours: simplified,
      insetContours,
      centroid,
      cellCount: region.cells.length,
    });
  }

  // 8. Assign piece numbers (largest piece = #1)
  const sortedForNumbering = [...polygonRegions].sort((a, b) => {
    const areaA = a.contours.reduce((s, c) => s + Math.abs(polygonArea(c)), 0);
    const areaB = b.contours.reduce((s, c) => s + Math.abs(polygonArea(c)), 0);
    return areaB - areaA;
  });
  sortedForNumbering.forEach((r, i) => { r.pieceNumber = i + 1; });

  // 9. Assign color letters (A, B, C, ...) to palette entries
  const colorLetters = palette.map((_, i) =>
    i < 26 ? String.fromCharCode(65 + i) : `A${i - 25}`
  );

  // 10. Build SVG strings (with piece number labels)
  const svgColored = buildSVG(polygonRegions, palette, pxW, pxH, lineThickness, false);
  const svgOutline = buildSVG(polygonRegions, palette, pxW, pxH, lineThickness, true);

  // 11. Convert SVG to canvas for preview and raster export
  const patternCanvas = await svgToCanvas(svgColored, pxW, pxH);
  const outlineCanvas = await svgToCanvas(svgOutline, pxW, pxH);

  // 12. Material estimates
  const estimates = calculatePolygonEstimates(polygonRegions, palette, colorLetters, settings, pxW, pxH);

  return {
    patternCanvas,
    outlineCanvas,
    svgColored,
    svgOutline,
    estimates,
    palette,
    colorLetters,
    polygonRegions,
    pxW,
    pxH,
    DPI,
  };
}
