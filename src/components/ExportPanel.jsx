import { useState } from 'react';
import {
  exportColoredPDF,
  exportOutlinePDF,
  exportPNG,
  exportSVG,
  exportPieceTemplates,
} from '../utils/pdfExporter.js';

function ExportButton({ label, description, icon, onClick, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-start gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      <span className="text-2xl leading-none mt-0.5">{loading ? '⏳' : icon}</span>
      <div>
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
    </button>
  );
}

export default function ExportPanel({ result, settings }) {
  const [loading, setLoading] = useState(null);

  const disabled = !result;

  async function run(key, fn) {
    setLoading(key);
    try { await fn(); }
    finally { setLoading(null); }
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Export &amp; Print</h2>

      {!result && (
        <p className="text-sm text-gray-400 text-center py-2 mb-3">
          Generate a pattern first to enable exports.
        </p>
      )}

      <div className="space-y-2">
        <ExportButton
          icon="🔢"
          label="Piece Templates (PDF)"
          description={`Individual cut templates for all ${result?.estimates?.numPieces ?? ''} pieces, numbered A–Z and sized for actual glass cutting (came-compensated).`}
          loading={loading === 'templates'}
          disabled={disabled || !result?.polygonRegions}
          onClick={() => run('templates', () => exportPieceTemplates(
            result.polygonRegions,
            result.palette,
            result.colorLetters,
            settings,
            result.pxW,
          ))}
        />

        <ExportButton
          icon="🖨️"
          label="Print Colored Pattern (PDF)"
          description="Full-color PDF at actual size. Tiled across pages if larger than letter."
          loading={loading === 'pdf-color'}
          disabled={disabled}
          onClick={() => run('pdf-color', () => exportColoredPDF(result.patternCanvas, settings))}
        />

        <ExportButton
          icon="✂️"
          label="Print Cutting Guide (PDF)"
          description="Black-on-white outlines with piece numbers — lay flat under glass to trace."
          loading={loading === 'pdf-outline'}
          disabled={disabled}
          onClick={() => run('pdf-outline', () => exportOutlinePDF(result.outlineCanvas, settings))}
        />

        <ExportButton
          icon="🎨"
          label="Download Colored Pattern (PNG)"
          description="High-res PNG of the colored stained glass pattern."
          loading={loading === 'png-color'}
          disabled={disabled}
          onClick={() => run('png-color', () => exportPNG(result.patternCanvas, 'stained-glass-pattern.png'))}
        />

        <ExportButton
          icon="📄"
          label="Download Cutting Guide (PNG)"
          description="High-res PNG of the cutting guide outline."
          loading={loading === 'png-outline'}
          disabled={disabled}
          onClick={() => run('png-outline', () => exportPNG(result.outlineCanvas, 'stained-glass-outline.png'))}
        />

        <ExportButton
          icon="📐"
          label="Download Pattern (SVG)"
          description="Scalable vector — ideal for precise tracing and resizing."
          loading={loading === 'svg-color'}
          disabled={disabled || !result?.svgColored}
          onClick={() => run('svg-color', () => exportSVG(result.svgColored, 'stained-glass-pattern.svg'))}
        />

        <ExportButton
          icon="📏"
          label="Download Cutting Guide (SVG)"
          description="Vector outline — scale to any size without quality loss."
          loading={loading === 'svg-outline'}
          disabled={disabled || !result?.svgOutline}
          onClick={() => run('svg-outline', () => exportSVG(result.svgOutline, 'stained-glass-outline.svg'))}
        />
      </div>

      {result && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
          <p><strong>Print tip:</strong> Set printer scale to 100% (actual size) — do not scale to fit.</p>
          <p>For large pieces, tape tiled pages together using the registration marks at each corner.</p>
          <p>Piece templates already account for your came width — trace and cut as shown.</p>
        </div>
      )}
    </div>
  );
}
