function Slider({ label, hint, min, max, step = 1, value, onChange }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <label className="label mb-0">{label}</label>
        <span className="text-sm font-semibold text-amber-700">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-600"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

const CAME_OPTIONS = [
  { value: 0.0625,  label: '1/16"', desc: 'very fine, decorative' },
  { value: 0.09375, label: '3/32"', desc: 'thin came' },
  { value: 0.125,   label: '1/8"',  desc: 'standard thin' },
  { value: 0.1875,  label: '3/16"', desc: 'standard (most common)' },
  { value: 0.25,    label: '1/4"',  desc: 'heavy came' },
];

function cameLabel(val) {
  const opt = CAME_OPTIONS.find(o => Math.abs(o.value - val) < 0.001);
  return opt ? opt.label : `${val}"`;
}

export default function PatternSettings({ settings, onChange }) {
  return (
    <div className="panel">
      <h2 className="panel-title">Pattern Settings</h2>

      <Slider
        label="Number of Colors"
        hint="Fewer colors = larger, simpler pieces. More = detail."
        min={2}
        max={20}
        value={settings.numColors}
        onChange={v => onChange({ numColors: v })}
      />

      <Slider
        label="Simplification"
        hint="Higher = smoother shapes, easier to cut."
        min={0}
        max={10}
        value={settings.blurRadius}
        onChange={v => onChange({ blurRadius: v })}
      />

      <Slider
        label="Lead Line Width"
        hint="Thickness of lead came lines in the pattern display."
        min={1}
        max={12}
        value={settings.lineThickness}
        onChange={v => onChange({ lineThickness: v })}
      />

      {/* Came Heart Width */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="label mb-0">Came Heart Width</label>
          <span className="text-sm font-semibold text-amber-700">{cameLabel(settings.cameWidth)}</span>
        </div>
        <select
          value={settings.cameWidth}
          onChange={e => onChange({ cameWidth: parseFloat(e.target.value) })}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {CAME_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {opt.desc}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Heart width used to inset each piece template so assembled work matches target size.
        </p>
      </div>

      <div className="mb-0">
        <div className="flex justify-between mb-1">
          <label className="label mb-0">Waste Factor</label>
          <span className="text-sm font-semibold text-amber-700">{settings.wastePercent}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={40}
          step={5}
          value={settings.wastePercent}
          onChange={e => onChange({ wastePercent: parseInt(e.target.value) })}
          className="w-full accent-amber-600"
        />
        <p className="text-xs text-gray-500 mt-1">Added to glass estimates for cutting waste.</p>
      </div>
    </div>
  );
}
