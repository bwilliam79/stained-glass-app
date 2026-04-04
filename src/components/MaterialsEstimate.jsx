function EstimateRow({ label, value, unit, accent }) {
  return (
    <div className={`flex justify-between items-center py-2 border-b border-gray-100 last:border-0 ${accent ? 'font-semibold' : ''}`}>
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-sm ${accent ? 'text-amber-700' : 'text-gray-900'}`}>
        {value} <span className="text-gray-500 font-normal text-xs">{unit}</span>
      </span>
    </div>
  );
}

export default function MaterialsEstimate({ estimates }) {
  if (!estimates) {
    return (
      <div className="panel">
        <h2 className="panel-title">Materials Estimate</h2>
        <p className="text-sm text-gray-400 text-center py-4">Generate a pattern to see estimates</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Materials Estimate</h2>

      <div className="mb-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h3>
        <EstimateRow label="Total Glass Needed" value={estimates.glassTotal.value} unit={estimates.glassTotal.unit} accent />
        <EstimateRow label="Interior Lead Came (H-channel)" value={estimates.interiorCame.value} unit={estimates.interiorCame.unit} />
        <EstimateRow label="Perimeter Lead Came (U-channel)" value={estimates.perimeterCame.value} unit={estimates.perimeterCame.unit} />
        <EstimateRow label="Total Came" value={estimates.cameLength.value} unit={estimates.cameLength.unit} accent />
        <EstimateRow label="Solder (50/50)" value={estimates.solderWeight.value} unit={estimates.solderWeight.unit} accent />
        <EstimateRow label="Number of Glass Pieces" value={estimates.numPieces} unit="pieces" />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Glass by Color</h3>
        <div className="space-y-2">
          {estimates.glassByColor.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
              />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700 font-medium">Color {c.colorLetter || String.fromCharCode(65 + i)}</span>
                  <span className="text-gray-600">
                    {c.areaSqFt.toFixed(3)} ft² &nbsp;·&nbsp; {c.areaIn.toFixed(1)} in²
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${Math.round(c.fraction * 100)}%`,
                      backgroundColor: `rgb(${c.r},${c.g},${c.b})`,
                    }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">
                {Math.round(c.fraction * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800 space-y-1">
        <p><strong>Note:</strong> Estimates include your {estimates.glassByColor.reduce ? '' : ''}waste factor.</p>
        <p>Buy came in standard 6-foot lengths. Solder is 50/50 tin/lead.</p>
        <p>Always purchase 10–15% extra to account for variations.</p>
      </div>
    </div>
  );
}
