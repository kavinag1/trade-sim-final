import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useMarket } from '../../contexts/MarketContext';
import { formatCurrency } from '../../utils/market';

export default function TradePanel({ symbol, currentPrice, userPortfolio }) {
  const [tab, setTab] = useState('BUY');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const { userProfile, refreshProfile } = useAuth();
  const { isOpen } = useMarket();

  const ownedPosition = userPortfolio?.find(p => p.symbol === symbol);
  const maxBuyShares = currentPrice > 0 ? Math.floor((userProfile?.cashBalance || 0) / currentPrice) : 0;
  const totalCost = (parseFloat(quantity) || 0) * (currentPrice || 0);
  const isValidQty = parseFloat(quantity) > 0 && Number.isInteger(parseFloat(quantity));

  async function handleTrade() {
    if (!isValidQty || !isOpen || loading) return;
    const qty = parseInt(quantity);
    if (tab === 'SELL' && (!ownedPosition || ownedPosition.shares < qty)) {
      setMessage({ type: 'error', text: 'Insufficient shares' });
      return;
    }
    if (tab === 'BUY' && qty > maxBuyShares) {
      setMessage({ type: 'error', text: 'Insufficient funds' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const executeTrade = httpsCallable(functions, 'executeTrade');
      const result = await executeTrade({
        ticker: symbol,
        buyOrSell: tab,
        quantity: qty,
      });
      setMessage({ type: 'success', text: `${tab} order executed: ${qty} shares of ${symbol}` });
      setQuantity('');
      await refreshProfile();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Trade failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-white mb-4">Trade {symbol}</h3>

      {!isOpen && (
        <div className="bg-red-900/20 border border-accent-red/30 rounded-lg p-3 mb-4 text-sm text-accent-red">
          Market Closed — Trading unavailable
        </div>
      )}

      {/* Buy/Sell tabs */}
      <div className="flex rounded-lg bg-dark-600 p-1 mb-4">
        {['BUY', 'SELL'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setMessage(null); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
              tab === t
                ? t === 'BUY' ? 'bg-accent-green text-dark-900' : 'bg-accent-red text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Shares</label>
          <input
            type="number"
            min="1"
            step="1"
            className="input"
            placeholder="Enter quantity"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            disabled={!isOpen}
          />
        </div>

        <div className="bg-dark-600 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Market Price</span>
            <span className="font-mono">{formatCurrency(currentPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Estimated {tab === 'BUY' ? 'Cost' : 'Proceeds'}</span>
            <span className="font-mono font-semibold">{formatCurrency(totalCost)}</span>
          </div>
          {tab === 'BUY' && (
            <div className="flex justify-between">
              <span className="text-gray-400">Cash Available</span>
              <span className="font-mono text-accent-green">{formatCurrency(userProfile?.cashBalance || 0)}</span>
            </div>
          )}
          {tab === 'SELL' && ownedPosition && (
            <div className="flex justify-between">
              <span className="text-gray-400">Shares Owned</span>
              <span className="font-mono">{ownedPosition.shares}</span>
            </div>
          )}
        </div>

        {tab === 'BUY' && (
          <p className="text-xs text-gray-500">Max you can buy: {maxBuyShares} shares</p>
        )}

        {message && (
          <div className={`text-sm p-3 rounded-lg ${
            message.type === 'error' ? 'bg-red-900/30 text-accent-red' : 'bg-emerald-900/30 text-accent-green'
          }`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={!isOpen || !isValidQty || loading}
          className={`w-full py-3 rounded-lg font-semibold transition-all ${
            tab === 'BUY'
              ? 'btn-green'
              : 'btn-red'
          }`}
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            `${tab} ${quantity || 0} Share${quantity !== '1' ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
}
