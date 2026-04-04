import { useState, useCallback } from 'react';
import DimensionsPanel from './components/DimensionsPanel.jsx';
import ImageUpload from './components/ImageUpload.jsx';
import PatternSettings from './components/PatternSettings.jsx';
import PatternCanvas from './components/PatternCanvas.jsx';
import MaterialsEstimate from './components/MaterialsEstimate.jsx';
import ExportPanel from './components/ExportPanel.jsx';
import { processImage } from './utils/imageProcessor.js';

const DEFAULT_SETTINGS = {
  width: 12,
  height: 18,
  units: 'in',
  numColors: 8,
  blurRadius: 4,
  lineThickness: 4,
  wastePercent: 15,
};

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');

  const updateSettings = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  function handleImageSelected(file) {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  async function handleGenerate() {
    if (!imageFile) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      setProgress('Applying blur and loading image…');
      // Small delay to let the UI update before heavy processing
      await new Promise(r => setTimeout(r, 30));

      setProgress('Quantizing colors (k-means)…');
      await new Promise(r => setTimeout(r, 30));

      const output = await processImage(imageFile, settings);

      setProgress('Building pattern…');
      await new Promise(r => setTimeout(r, 10));

      setResult(output);
    } catch (err) {
      console.error(err);
      setError(`Processing failed: ${err.message}`);
    } finally {
      setProcessing(false);
      setProgress('');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center text-white text-lg shadow">
              ✦
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Stained Glass Pattern Maker</h1>
              <p className="text-xs text-gray-500">Convert any image into a cuttable stained glass pattern</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column — Controls */}
          <div className="lg:col-span-1 space-y-4">
            <DimensionsPanel settings={settings} onChange={updateSettings} />
            <ImageUpload imageUrl={imageUrl} onImageSelected={handleImageSelected} />
            <PatternSettings settings={settings} onChange={updateSettings} />

            {/* Generate Button */}
            <div>
              <button
                onClick={handleGenerate}
                disabled={!imageFile || processing}
                className="btn-primary w-full text-base flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Processing…
                  </>
                ) : (
                  <>✦ Generate Pattern</>
                )}
              </button>
              {processing && progress && (
                <p className="text-xs text-gray-500 text-center mt-2">{progress}</p>
              )}
              {!imageFile && (
                <p className="text-xs text-gray-400 text-center mt-2">Upload an image to get started</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Right Column — Pattern + Estimates + Export */}
          <div className="lg:col-span-2 space-y-4">
            <PatternCanvas result={result} settings={settings} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MaterialsEstimate estimates={result?.estimates} />
              <ExportPanel result={result} settings={settings} />
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-8 border-t border-gray-200 py-4">
        <p className="text-center text-xs text-gray-400">
          Stained Glass Pattern Maker — all processing happens in your browser
        </p>
      </footer>
    </div>
  );
}
