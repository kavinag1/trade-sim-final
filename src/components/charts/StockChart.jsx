import { useEffect, useState } from 'react';
import { getCandles } from '../../services/finnhub';

const RANGES = [
  { label: '1D', resolution: '5', days: 1 },
  { label: '5D', resolution: '15', days: 5 },
  { label: '1M', resolution: '60', days: 30 },
  { label: '6M', resolution: 'D', days: 180 },
  { label: '1Y', resolution: 'D', days: 365 },
  { label: '5Y', resolution: 'W', days: 1825 },
];

export default function StockChart({ symbol }) {
  const [activeRange, setActiveRange] = useState('1M');
  const [loading, setLoading] = useState(false);
  const [candles, setCandles] = useState([]);
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    if (!symbol) return;
    loadCandles(activeRange);
  }, [symbol, activeRange]);

  async function loadCandles(rangeLabel) {
    const range = RANGES.find(r => r.label === rangeLabel);
    if (!range) return;
    setLoading(true);
    setChartError('');
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range.days * 86400;
      let next = await getCandles(symbol, range.resolution, from, to);

      // Fallback: if intraday range has no data (weekend/holiday), try 1M daily candles.
      if (next.length === 0 && range.resolution !== 'D') {
        next = await getCandles(symbol, 'D', to - 30 * 86400, to);
      }

      setCandles(next);
      if (next.length === 0) {
        setChartError('No chart data available for this symbol/range right now.');
      }
    } catch (err) {
      console.error(err);
      setCandles([]);
      setChartError(err.message || 'Failed to load chart data.');
    } finally {
      setLoading(false);
    }
  }

  const closeSeries = candles.map(c => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  const minClose = closeSeries.length ? Math.min(...closeSeries.map(p => p.close)) : 0;
  const maxClose = closeSeries.length ? Math.max(...closeSeries.map(p => p.close)) : 0;
  const latest = closeSeries.length ? closeSeries[closeSeries.length - 1] : null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Price Data</h3>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setActiveRange(r.label)}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                activeRange === r.label
                  ? 'bg-accent-blue text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {latest && (
        <div className="mb-3 text-xs text-gray-400 font-mono flex flex-wrap gap-x-4 gap-y-1">
          <span>Open: {latest.open.toFixed(2)}</span>
          <span>High: {latest.high.toFixed(2)}</span>
          <span>Low: {latest.low.toFixed(2)}</span>
          <span>Close: {latest.close.toFixed(2)}</span>
          <span>Range High: {maxClose.toFixed(2)}</span>
          <span>Range Low: {minClose.toFixed(2)}</span>
        </div>
      )}

      {loading && (
        <div className="h-24 bg-dark-800/60 border border-dark-600 rounded-lg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && chartError && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-accent-red/30 text-sm text-gray-200">
          {chartError}
        </div>
      )}

      {closeSeries.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-dark-600">
                <th className="text-left py-2">Time</th>
                <th className="text-right py-2">Open</th>
                <th className="text-right py-2">High</th>
                <th className="text-right py-2">Low</th>
                <th className="text-right py-2">Close</th>
              </tr>
            </thead>
            <tbody>
              {closeSeries.slice(-8).reverse().map((row) => (
                <tr key={row.time} className="border-b border-dark-700/70">
                  <td className="py-2 text-gray-400">{new Date(row.time * 1000).toLocaleString()}</td>
                  <td className="py-2 text-right font-mono">{row.open.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono text-accent-green">{row.high.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono text-accent-red">{row.low.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">{row.close.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
