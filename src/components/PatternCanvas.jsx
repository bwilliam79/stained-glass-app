import { useEffect, useRef, useState } from 'react';

export default function PatternCanvas({ result, settings }) {
  const canvasRef = useRef(null);
  const [view, setView] = useState('colored');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const src = view === 'colored' ? result.patternCanvas : result.outlineCanvas;
    const dst = canvasRef.current;
    dst.width = src.width;
    dst.height = src.height;
    dst.getContext('2d').drawImage(src, 0, 0);
  }, [result, view]);

  if (!result) {
    return (
      <div className="panel flex flex-col items-center justify-center min-h-64 text-gray-400">
        <div className="text-6xl mb-4">✦</div>
        <p className="text-lg font-medium">Pattern will appear here</p>
        <p className="text-sm mt-1">Upload an image and click Generate Pattern</p>
      </div>
    );
  }

  const { pxW, pxH, DPI, estimates } = result;
  const artWIn = settings.units === 'in' ? settings.width : settings.width / 2.54;
  const artHIn = settings.units === 'in' ? settings.height : settings.height / 2.54;

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="panel-title mb-0">Pattern Preview</h2>
        <div className="flex gap-2 items-center">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {['colored', 'outline'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === 'colored' ? 'Colored' : 'Cutting Guide'}
              </button>
            ))}
          </div>
          {/* Zoom */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {[0.5, 1, 1.5, 2].map(z => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                  zoom === z
                    ? 'bg-amber-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {z === 1 ? '1×' : z === 0.5 ? '½×' : z === 1.5 ? '1.5×' : '2×'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-auto border border-gray-200 rounded-lg bg-gray-100 p-2">
        <div
          style={{
            width: pxW * zoom,
            height: pxH * zoom,
            flexShrink: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: pxW * zoom,
              height: pxH * zoom,
              display: 'block',
              imageRendering: zoom > 1 ? 'pixelated' : 'auto',
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span>Size: {artWIn.toFixed(2)}" × {artHIn.toFixed(2)}"</span>
        <span>Resolution: {pxW} × {pxH}px at {DPI} DPI</span>
        <span>{estimates.glassByColor.length} glass colors</span>
      </div>

      {/* Color palette */}
      <div className="mt-4">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Color Palette</h3>
        <div className="flex flex-wrap gap-2">
          {estimates.glassByColor.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
              <div
                className="w-5 h-5 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
              />
              <div className="text-xs">
                <div className="font-medium text-gray-700">Color {i + 1}</div>
                <div className="text-gray-500">{c.areaSqFt.toFixed(3)} ft²</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
