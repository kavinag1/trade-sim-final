import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/market';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 25;

export default function TradeHistoryPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (user) { setTrades([]); setLastDoc(null); loadTrades(true); }
  }, [user, filter]);

  async function loadTrades(reset = false) {
    if (!user) return;
    setLoading(true);
    try {
      const tradesRef = collection(db, 'trades');
      let q = query(
        tradesRef,
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE)
      );
      if (!reset && lastDoc) q = query(q, startAfter(lastDoc));

      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = filter === 'ALL' ? docs : docs.filter(d => d.buyOrSell === filter);

      setTrades(prev => reset ? filtered : [...prev, ...filtered]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: trades.length,
    buys: trades.filter(t => t.buyOrSell === 'BUY').length,
    sells: trades.filter(t => t.buyOrSell === 'SELL').length,
    volume: trades.reduce((sum, t) => sum + (t.totalValue || 0), 0),
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Trade History</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Trades', value: stats.total, color: 'text-white' },
          { label: 'Buy Orders', value: stats.buys, color: 'text-accent-green' },
          { label: 'Sell Orders', value: stats.sells, color: 'text-accent-red' },
          { label: 'Total Volume', value: formatCurrency(stats.volume), color: 'text-accent-blue' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['ALL', 'BUY', 'SELL'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-accent-blue text-white' : 'text-gray-400 hover:text-white hover:bg-dark-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && trades.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : trades.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-white mb-2">No trades yet</h3>
          <p className="text-gray-400 text-sm mb-4">Your trade history will appear here</p>
          <Link to="/search" className="btn-primary inline-block">Start Trading</Link>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-600">
                  <th className="text-left pb-3">Date & Time</th>
                  <th className="text-left pb-3">Type</th>
                  <th className="text-left pb-3">Symbol</th>
                  <th className="text-right pb-3">Shares</th>
                  <th className="text-right pb-3">Price</th>
                  <th className="text-right pb-3">Total Value</th>
                  <th className="text-right pb-3">Cash After</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => {
                  const ts = trade.timestamp?.toDate ? trade.timestamp.toDate() : new Date();
                  return (
                    <tr key={trade.id} className="table-row">
                      <td className="py-2.5 pr-4">
                        <div className="text-gray-300">{ts.toLocaleDateString()}</div>
                        <div className="text-gray-500 text-xs">{ts.toLocaleTimeString()}</div>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          trade.buyOrSell === 'BUY'
                            ? 'bg-emerald-900/40 text-accent-green'
                            : 'bg-red-900/40 text-accent-red'
                        }`}>
                          {trade.buyOrSell}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <Link to={`/stock/${trade.ticker}`} className="font-mono font-bold text-accent-blue hover:underline">
                          {trade.ticker}
                        </Link>
                      </td>
                      <td className="py-2.5 text-right font-mono">{trade.quantity}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(trade.price)}</td>
                      <td className="py-2.5 text-right font-mono font-semibold">{formatCurrency(trade.totalValue)}</td>
                      <td className="py-2.5 text-right font-mono text-gray-400">{formatCurrency(trade.cashAfterTrade)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <button onClick={() => loadTrades(false)} disabled={loading} className="btn-ghost text-sm">
                {loading ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
