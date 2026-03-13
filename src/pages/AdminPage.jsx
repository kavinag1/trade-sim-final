import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/market';
import { STARTING_BALANCE } from '../config';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersSnap, tradesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('netWorth', 'desc'))),
        getDocs(query(collection(db, 'trades'), orderBy('timestamp', 'desc'))),
      ]);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTrades(tradesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function resetCompetition() {
    setActionLoading(true);
    try {
      const adminReset = httpsCallable(functions, 'adminResetCompetition');
      await adminReset();
      await loadData();
      alert('Competition reset successfully!');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  async function resetUser(userId) {
    setActionLoading(true);
    try {
      const adminResetUser = httpsCallable(functions, 'adminResetUser');
      await adminResetUser({ targetUserId: userId });
      await loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  function exportTrades() {
    const headers = ['Timestamp', 'Email', 'Team', 'Ticker', 'Buy/Sell', 'Shares', 'Price', 'Total Value', 'Cash After', 'Net Worth After'];
    const rows = trades.map(t => [
      t.timestamp?.toDate?.()?.toISOString() || '',
      t.userEmail || '',
      t.teamName || '',
      t.ticker,
      t.buyOrSell,
      t.quantity,
      t.price,
      t.totalValue,
      t.cashAfterTrade,
      t.netWorthAfterTrade,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <span>🛡️</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-500 text-xs">Competition management</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setConfirmAction({ type: 'resetAll' })}
          className="bg-red-900/30 hover:bg-red-900/50 text-accent-red border border-accent-red/30 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          🔄 Reset Entire Competition
        </button>
        <button
          onClick={exportTrades}
          className="btn-ghost text-sm border border-dark-500"
        >
          📥 Export Trades CSV
        </button>
        <button onClick={loadData} className="btn-ghost text-sm">↻ Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-dark-600">
        {[
          { key: 'users', label: `Users (${users.length})` },
          { key: 'trades', label: `All Trades (${trades.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key ? 'border-accent-blue text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'users' ? (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-600">
                  <th className="text-left pb-3">Team / Email</th>
                  <th className="text-right pb-3">Cash</th>
                  <th className="text-right pb-3">Net Worth</th>
                  <th className="text-right pb-3">P&L</th>
                  <th className="text-right pb-3">Trades</th>
                  <th className="text-right pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="py-2.5 pr-4">
                      <div className="font-semibold text-white">{u.teamName}</div>
                      <div className="text-gray-500 text-xs">{u.email}</div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-sm">{formatCurrency(u.cashBalance || 0)}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-accent-green">{formatCurrency(u.netWorth || 0)}</td>
                    <td className={`py-2.5 text-right font-mono text-sm ${((u.netWorth || 0) - 100000) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {formatCurrency((u.netWorth || 0) - 100000)}
                    </td>
                    <td className="py-2.5 text-right font-mono text-gray-400">{u.totalTrades || 0}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setConfirmAction({ type: 'resetUser', userId: u.id, teamName: u.teamName })}
                        className="text-xs text-accent-red hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-600">
                  <th className="text-left pb-3">Time</th>
                  <th className="text-left pb-3">User</th>
                  <th className="text-left pb-3">Type</th>
                  <th className="text-left pb-3">Ticker</th>
                  <th className="text-right pb-3">Shares</th>
                  <th className="text-right pb-3">Price</th>
                  <th className="text-right pb-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => {
                  const ts = trade.timestamp?.toDate?.() || new Date();
                  return (
                    <tr key={trade.id} className="table-row">
                      <td className="py-2.5 text-gray-400 text-xs">{ts.toLocaleDateString()} {ts.toLocaleTimeString()}</td>
                      <td className="py-2.5 text-gray-300 text-xs">{trade.userEmail || trade.userId?.slice(0, 8)}</td>
                      <td className="py-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${trade.buyOrSell === 'BUY' ? 'bg-emerald-900/40 text-accent-green' : 'bg-red-900/40 text-accent-red'}`}>
                          {trade.buyOrSell}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono font-bold text-accent-blue">{trade.ticker}</td>
                      <td className="py-2.5 text-right font-mono">{trade.quantity}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(trade.price)}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(trade.totalValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-3">Confirm Action</h3>
            {confirmAction.type === 'resetAll' ? (
              <p className="text-gray-400 text-sm mb-6">
                This will reset ALL users' cash to $100,000 and clear all portfolios and trades. This cannot be undone.
              </p>
            ) : (
              <p className="text-gray-400 text-sm mb-6">
                Reset <strong className="text-white">{confirmAction.teamName}</strong>? This will reset their cash to $100,000 and clear their portfolio.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="btn-ghost flex-1">Cancel</button>
              <button
                onClick={() => confirmAction.type === 'resetAll' ? resetCompetition() : resetUser(confirmAction.userId)}
                disabled={actionLoading}
                className="bg-accent-red hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg flex-1"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
