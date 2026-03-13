import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMultipleQuotes } from '../../services/finnhub';
import { formatCurrency, formatPercent } from '../../utils/market';

export default function WatchlistWidget({ watchlist }) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (watchlist.length === 0) return;
    setLoading(true);
    getMultipleQuotes(watchlist)
      .then(setQuotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [watchlist]);

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Watchlist</h3>
        <Link to="/watchlist" className="text-xs text-accent-blue hover:underline">Manage</Link>
      </div>

      {watchlist.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">⭐</div>
          <p className="text-gray-500 text-sm">No stocks in watchlist</p>
          <Link to="/search" className="text-accent-blue text-xs mt-2 hover:underline block">Add stocks</Link>
        </div>
      ) : (
        <div className="space-y-1">
          {watchlist.map(symbol => {
            const q = quotes[symbol];
            return (
              <Link
                key={symbol}
                to={`/stock/${symbol}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-dark-600 transition-colors"
              >
                <div>
                  <div className="font-mono font-semibold text-sm text-white">{symbol}</div>
                </div>
                <div className="text-right">
                  {loading || !q ? (
                    <div className="w-16 h-4 bg-dark-600 rounded animate-pulse" />
                  ) : (
                    <>
                      <div className="font-mono text-sm">{formatCurrency(q.price)}</div>
                      <div className={`text-xs font-mono ${q.changePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {formatPercent(q.changePercent)}
                      </div>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
