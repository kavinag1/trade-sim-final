import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useMarket } from '../contexts/MarketContext';
import { getMultipleQuotes } from '../services/finnhub';
import { formatCurrency, formatPercent } from '../utils/market';

export default function PortfolioPage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { isOpen } = useMarket();
  const [portfolioData, setPortfolioData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellModal, setSellModal] = useState(null);
  const [sellQty, setSellQty] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState(null);

  useEffect(() => {
    if (userProfile?.portfolio) loadPortfolio();
  }, [userProfile]);

  async function loadPortfolio() {
    const portfolio = userProfile?.portfolio || [];
    if (portfolio.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      const symbols = portfolio.map(p => p.symbol);
      const quotes = await getMultipleQuotes(symbols);
      const enriched = portfolio.map(p => {
        const q = quotes[p.symbol] || {};
        const currentPrice = q.price || 0;
        const currentValue = currentPrice * p.shares;
        const costBasis = p.avgPrice * p.shares;
        const pnl = currentValue - costBasis;
        const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        return { ...p, currentPrice, currentValue, costBasis, pnl, pnlPct, change: q.changePercent || 0 };
      });
      setPortfolioData(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function executeSell() {
    if (!sellModal || !sellQty || tradeLoading) return;
    const qty = parseInt(sellQty);
    if (!qty || qty <= 0 || qty > sellModal.shares) {
      setTradeMessage({ type: 'error', text: 'Invalid quantity' });
      return;
    }
    setTradeLoading(true);
    setTradeMessage(null);
    try {
      const executeTrade = httpsCallable(functions, 'executeTrade');
      await executeTrade({ ticker: sellModal.symbol, buyOrSell: 'SELL', quantity: qty });
      setTradeMessage({ type: 'success', text: `Sold ${qty} shares of ${sellModal.symbol}` });
      setSellModal(null);
      setSellQty('');
      await refreshProfile();
    } catch (err) {
      setTradeMessage({ type: 'error', text: err.message || 'Trade failed' });
    } finally {
      setTradeLoading(false);
    }
  }

  const totalValue = portfolioData.reduce((s, p) => s + p.currentValue, 0);
  const totalPnL = portfolioData.reduce((s, p) => s + p.pnl, 0);
  const totalCost = portfolioData.reduce((s, p) => s + p.costBasis, 0);
  const netWorth = (userProfile?.cashBalance || 0) + totalValue;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Portfolio</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Portfolio Value', value: formatCurrency(totalValue), color: 'text-purple-400' },
          { label: 'Cash Balance', value: formatCurrency(userProfile?.cashBalance || 0), color: 'text-accent-blue' },
          { label: 'Net Worth', value: formatCurrency(netWorth), color: 'text-accent-green' },
          { label: 'Total P&L', value: formatCurrency(totalPnL), sub: formatPercent(totalCost > 0 ? (totalPnL / totalCost) * 100 : 0), color: totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="card">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</div>
            {sub && <div className={`text-xs mt-0.5 ${color}`}>{sub}</div>}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : portfolioData.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">💼</div>
          <h3 className="text-lg font-semibold text-white mb-2">No positions yet</h3>
          <p className="text-gray-400 text-sm mb-4">Start trading to see your portfolio here</p>
          <Link to="/search" className="btn-primary inline-block">Search Stocks</Link>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Open Positions ({portfolioData.length})</h3>
            {!isOpen && <span className="text-xs text-accent-red bg-red-900/20 px-2 py-1 rounded">Market Closed — Selling disabled</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-600">
                  <th className="text-left pb-3">Symbol</th>
                  <th className="text-right pb-3">Shares</th>
                  <th className="text-right pb-3">Avg Price</th>
                  <th className="text-right pb-3">Current</th>
                  <th className="text-right pb-3">Total Value</th>
                  <th className="text-right pb-3">P&L</th>
                  <th className="text-right pb-3">% Gain</th>
                  <th className="text-right pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {portfolioData.map(pos => (
                  <tr key={pos.symbol} className="table-row">
                    <td className="py-3 pr-4">
                      <Link to={`/stock/${pos.symbol}`} className="font-mono font-bold text-accent-blue hover:underline">
                        {pos.symbol}
                      </Link>
                    </td>
                    <td className="py-3 text-right font-mono">{pos.shares}</td>
                    <td className="py-3 text-right font-mono text-gray-400">{formatCurrency(pos.avgPrice)}</td>
                    <td className="py-3 text-right font-mono">{formatCurrency(pos.currentPrice)}</td>
                    <td className="py-3 text-right font-mono">{formatCurrency(pos.currentValue)}</td>
                    <td className={`py-3 text-right font-mono ${pos.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatCurrency(pos.pnl)}
                    </td>
                    <td className={`py-3 text-right font-mono ${pos.pnlPct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatPercent(pos.pnlPct)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => { setSellModal(pos); setSellQty(''); setTradeMessage(null); }}
                        disabled={!isOpen}
                        className="btn-red text-xs py-1.5 px-3"
                      >
                        Sell
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Sell {sellModal.symbol}</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">
                You own <span className="text-white font-mono">{sellModal.shares}</span> shares at avg{' '}
                <span className="text-white font-mono">{formatCurrency(sellModal.avgPrice)}</span>
              </div>
              <div className="text-sm text-gray-400">
                Current price: <span className="text-white font-mono">{formatCurrency(sellModal.currentPrice)}</span>
              </div>
              <input
                type="number"
                className="input"
                placeholder={`Qty (max ${sellModal.shares})`}
                value={sellQty}
                min={1}
                max={sellModal.shares}
                onChange={e => setSellQty(e.target.value)}
              />
              {sellQty && (
                <div className="text-sm text-accent-green">
                  Proceeds: {formatCurrency(parseInt(sellQty) * sellModal.currentPrice)}
                </div>
              )}
              {tradeMessage && (
                <div className={`text-sm p-2 rounded ${tradeMessage.type === 'error' ? 'text-accent-red bg-red-900/20' : 'text-accent-green bg-emerald-900/20'}`}>
                  {tradeMessage.text}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setSellModal(null)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={executeSell} disabled={tradeLoading} className="btn-red flex-1">
                  {tradeLoading ? 'Processing...' : 'Confirm Sell'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
