export default function DimensionsPanel({ settings, onChange }) {
  const unit = settings.units;

  return (
    <div className="panel">
      <h2 className="panel-title">Piece Dimensions</h2>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Width ({unit})</label>
          <input
            type="number"
            className="input"
            min="1"
            max={unit === 'in' ? 120 : 305}
            step="0.25"
            value={settings.width}
            onChange={e => onChange({ width: parseFloat(e.target.value) || 1 })}
          />
        </div>
        <div>
          <label className="label">Height ({unit})</label>
          <input
            type="number"
            className="input"
            min="1"
            max={unit === 'in' ? 120 : 305}
            step="0.25"
            value={settings.height}
            onChange={e => onChange({ height: parseFloat(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div>
        <label className="label">Units</label>
        <div className="flex gap-2">
          {['in', 'cm'].map(u => (
            <button
              key={u}
              onClick={() => onChange({ units: u })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                unit === u
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {u === 'in' ? 'Inches' : 'Centimeters'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 p-3 bg-amber-50 rounded-lg text-xs text-amber-800">
        <strong>Final size:</strong>{' '}
        {settings.units === 'in'
          ? `${settings.width}" × ${settings.height}" (${(settings.width * settings.height).toFixed(1)} sq in)`
          : `${settings.width} × ${settings.height} cm (${(settings.width * settings.height).toFixed(1)} sq cm)`}
      </div>
    </div>
  );
}
