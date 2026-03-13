import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getMultipleQuotes } from '../services/finnhub';
import { formatCurrency, formatPercent } from '../utils/market';
import { Link } from 'react-router-dom';
import NetWorthChart from '../components/Dashboard/NetWorthChart';
import WatchlistWidget from '../components/Dashboard/WatchlistWidget';

export default function Dashboard() {
  const { userProfile, user } = useAuth();
  const [portfolioData, setPortfolioData] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userProfile) return;
    loadData();
  }, [user, userProfile]);

  async function loadData() {
    setLoading(true);
    try {
      const portfolio = userProfile?.portfolio || [];
      if (portfolio.length > 0) {
        const symbols = portfolio.map(p => p.symbol);
        const quotes = await getMultipleQuotes(symbols);

        const enriched = portfolio.map(p => {
          const q = quotes[p.symbol] || {};
          const currentValue = (q.price || 0) * p.shares;
          const cost = p.avgPrice * p.shares;
          const pnl = currentValue - cost;
          const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
          return { ...p, currentPrice: q.price || 0, currentValue, pnl, pnlPct, quote: q };
        });
        setPortfolioData(enriched);
      }

      const tradesRef = collection(db, 'trades');
      const q = query(tradesRef, where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(5));
      const snap = await getDocs(q);
      setRecentTrades(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const portfolioValue = portfolioData.reduce((s, p) => s + p.currentValue, 0);
  const netWorth = (userProfile?.cashBalance || 0) + portfolioValue;
  // Compare current computed net worth vs last persisted account net worth.
  // This avoids misleading "daily" loss when user just opened a new position today.
  const baselineNetWorth = userProfile?.netWorth ?? 100000;
  const dailyPnL = netWorth - baselineNetWorth;
  const totalPnL = netWorth - 100000;

  const stats = [
    {
      label: 'Cash Balance',
      value: formatCurrency(userProfile?.cashBalance || 0),
      sub: 'Available to trade',
      color: 'text-accent-blue',
    },
    {
      label: 'Portfolio Value',
      value: formatCurrency(portfolioValue),
      sub: `${portfolioData.length} position${portfolioData.length !== 1 ? 's' : ''}`,
      color: 'text-purple-400',
    },
    {
      label: 'Net Worth',
      value: formatCurrency(netWorth),
      sub: 'Cash + Portfolio',
      color: 'text-accent-green',
    },
    {
      label: 'Daily P&L',
      value: formatCurrency(dailyPnL),
      sub: 'Since last account update',
      color: dailyPnL >= 0 ? 'text-accent-green' : 'text-accent-red',
    },
    {
      label: 'Total P&L',
      value: formatCurrency(totalPnL),
      sub: formatPercent((totalPnL / 100000) * 100),
      color: totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {userProfile?.teamName || userProfile?.name || 'Trader'} 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">Here's your portfolio overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {stats.map(({ label, value, sub, color }) => (
          <div key={label} className="card">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Net Worth Chart */}
        <div className="xl:col-span-2">
          <NetWorthChart userId={user?.uid} />
        </div>

        {/* Watchlist Widget */}
        <div>
          <WatchlistWidget watchlist={userProfile?.watchlist || []} />
        </div>
      </div>

      {/* Portfolio positions */}
      {portfolioData.length > 0 && (
        <div className="mt-6 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Open Positions</h3>
            <Link to="/portfolio" className="text-xs text-accent-blue hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="text-left pb-2">Symbol</th>
                  <th className="text-right pb-2">Shares</th>
                  <th className="text-right pb-2">Avg Price</th>
                  <th className="text-right pb-2">Current</th>
                  <th className="text-right pb-2">Value</th>
                  <th className="text-right pb-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {portfolioData.slice(0, 5).map(pos => (
                  <tr key={pos.symbol} className="table-row">
                    <td className="py-2 pr-4">
                      <Link to={`/stock/${pos.symbol}`} className="text-accent-blue hover:underline font-mono font-semibold">
                        {pos.symbol}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono">{pos.shares}</td>
                    <td className="py-2 text-right font-mono text-gray-400">{formatCurrency(pos.avgPrice)}</td>
                    <td className="py-2 text-right font-mono">{formatCurrency(pos.currentPrice)}</td>
                    <td className="py-2 text-right font-mono">{formatCurrency(pos.currentValue)}</td>
                    <td className={`py-2 text-right font-mono ${pos.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatCurrency(pos.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Trades */}
      {recentTrades.length > 0 && (
        <div className="mt-6 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Recent Trades</h3>
            <Link to="/history" className="text-xs text-accent-blue hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recentTrades.map(trade => (
              <div key={trade.id} className="flex items-center justify-between py-2 border-b border-dark-600 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    trade.buyOrSell === 'BUY' ? 'bg-emerald-900/40 text-accent-green' : 'bg-red-900/40 text-accent-red'
                  }`}>
                    {trade.buyOrSell}
                  </span>
                  <span className="font-mono font-semibold text-white">{trade.ticker}</span>
                  <span className="text-gray-400 text-sm">{trade.quantity} shares</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{formatCurrency(trade.totalValue)}</div>
                  <div className="text-gray-500 text-xs">
                    {trade.timestamp?.toDate ? trade.timestamp.toDate().toLocaleDateString() : 'Recent'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && portfolioData.length === 0 && recentTrades.length === 0 && (
        <div className="mt-6 card text-center py-12">
          <div className="text-4xl mb-4">📈</div>
          <h3 className="text-lg font-semibold text-white mb-2">Start Trading!</h3>
          <p className="text-gray-400 text-sm mb-4">
            You have {formatCurrency(userProfile?.cashBalance || 0)} in virtual cash ready to invest.
          </p>
          <Link to="/search" className="btn-primary inline-block">Search Stocks</Link>
        </div>
      )}
    </div>
  );
}
