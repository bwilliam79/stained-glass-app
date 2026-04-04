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
        hint="Thickness of lead came lines in the pattern."
        min={1}
        max={12}
        value={settings.lineThickness}
        onChange={v => onChange({ lineThickness: v })}
      />

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
