import { useEffect, useState } from 'react';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getMultipleQuotes } from '../services/finnhub';
import { formatCurrency, formatPercent } from '../utils/market';
import { Link } from 'react-router-dom';

export default function WatchlistPage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);

  const watchlist = userProfile?.watchlist || [];

  useEffect(() => {
    if (watchlist.length > 0) loadQuotes();
  }, [watchlist.length]);

  async function loadQuotes() {
    setLoading(true);
    try {
      const q = await getMultipleQuotes(watchlist);
      setQuotes(q);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function removeFromWatchlist(symbol) {
    try {
      await updateDoc(doc(db, 'users', user.uid), { watchlist: arrayRemove(symbol) });
      await refreshProfile();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Watchlist</h1>
        <Link to="/search" className="btn-primary text-sm">+ Add Stocks</Link>
      </div>

      {watchlist.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">⭐</div>
          <h3 className="text-lg font-semibold text-white mb-2">Your watchlist is empty</h3>
          <p className="text-gray-400 text-sm mb-4">Add stocks to track them here</p>
          <Link to="/search" className="btn-primary inline-block">Browse Stocks</Link>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-600">
                  <th className="text-left pb-3">Symbol</th>
                  <th className="text-right pb-3">Price</th>
                  <th className="text-right pb-3">Change</th>
                  <th className="text-right pb-3">% Change</th>
                  <th className="text-right pb-3">High</th>
                  <th className="text-right pb-3">Low</th>
                  <th className="text-right pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map(symbol => {
                  const q = quotes[symbol];
                  return (
                    <tr key={symbol} className="table-row">
                      <td className="py-3 pr-4">
                        <Link to={`/stock/${symbol}`} className="font-mono font-bold text-accent-blue hover:underline">
                          {symbol}
                        </Link>
                      </td>
                      {loading || !q ? (
                        <>
                          {[...Array(5)].map((_, i) => (
                            <td key={i} className="py-3 text-right">
                              <div className="w-16 h-4 bg-dark-600 rounded animate-pulse ml-auto" />
                            </td>
                          ))}
                        </>
                      ) : (
                        <>
                          <td className="py-3 text-right font-mono">{formatCurrency(q.price)}</td>
                          <td className={`py-3 text-right font-mono ${q.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {q.change >= 0 ? '+' : ''}{formatCurrency(q.change)}
                          </td>
                          <td className={`py-3 text-right font-mono ${q.changePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {formatPercent(q.changePercent)}
                          </td>
                          <td className="py-3 text-right font-mono text-gray-400">{formatCurrency(q.high)}</td>
                          <td className="py-3 text-right font-mono text-gray-400">{formatCurrency(q.low)}</td>
                        </>
                      )}
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/stock/${symbol}`} className="btn-ghost text-xs py-1 px-2">Trade</Link>
                          <button
                            onClick={() => removeFromWatchlist(symbol)}
                            className="text-gray-600 hover:text-accent-red text-xs py-1 px-2 rounded hover:bg-red-900/20 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
