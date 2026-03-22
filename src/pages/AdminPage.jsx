
function escapeCsv(value) {
  const raw = value ?? '';
  const str = String(raw);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function AdminPage() {
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersSnap, tradesSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('netWorth', 'desc'))),
        getDocs(query(collection(db, 'trades'), orderBy('timestamp', 'desc')))
      ]);

      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTrades(tradesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      alert('Failed to load admin data.');
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
      alert('Competition reset successfully.');
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
      alert('User reset successfully.');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  function exportTrades() {
    const headers = [
      'Timestamp',
      'Email',
      'Team',
      'Ticker',
      'Buy/Sell',
      'Shares',
      'Price',
      'Total Value',
      'Cash After',
      'Net Worth After'
    ];

    const rows = trades.map((t) => [
      t.timestamp?.toDate?.()?.toISOString() || '',
      t.userEmail || '',
      t.teamName || '',
      t.ticker || '',
      t.buyOrSell || '',
      t.quantity ?? '',
      t.price ?? '',
      t.totalValue ?? '',
      t.cashAfterTrade ?? '',
      t.netWorthAfterTrade ?? ''
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => {
    const tickerMap = {};
    const weekdayMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const hourMap = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      count: 0
    }));
    const sideCounts = { BUY: 0, SELL: 0 };
    const userTradeMap = {};

    let totalNotional = 0;

    for (const t of trades) {
      const ticker = (t.ticker || 'N/A').toUpperCase();
      const qty = Number(t.quantity) || 0;
      const price = Number(t.price) || 0;
      const value = Math.abs(Number(t.totalValue) || qty * price);
      const side = (t.buyOrSell || '').toUpperCase();
      const ts = t.timestamp?.toDate?.() || null;
      const userKey = t.teamName || t.userEmail || t.userId || 'Unknown';

      totalNotional += value;

      if (!tickerMap[ticker]) {
        tickerMap[ticker] = { ticker, count: 0, notional: 0 };
      }
      tickerMap[ticker].count += 1;
      tickerMap[ticker].notional += value;

      if (side === 'BUY' || side === 'SELL') {
        sideCounts[side] += 1;
      }

      if (!userTradeMap[userKey]) {
        userTradeMap[userKey] = 0;
      }
      userTradeMap[userKey] += 1;

      if (ts) {
        const day = ts.toLocaleDateString('en-US', { weekday: 'short' });
        if (weekdayMap[day] !== undefined) weekdayMap[day] += 1;
        const hour = ts.getHours();
        if (hourMap[hour]) hourMap[hour].count += 1;
      }
    }

    const userPnL = users.map((u) => {
      const netWorth = Number(u.netWorth) || 0;
      return {
        name: u.teamName || u.email || 'Unknown',
        pnl: netWorth - STARTING_BALANCE,
        netWorth
      };
    });

    const profitableUsers = userPnL.filter((u) => u.pnl > 0).length;
    const activeUsers = Object.keys(userTradeMap).length;
    const avgTradesPerActiveUser = activeUsers > 0 ? trades.length / activeUsers : 0;

    const topTickers = Object.values(tickerMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const tradesByWeekday = Object.entries(weekdayMap).map(([day, count]) => ({ day, count }));

    const topTraders = Object.entries(userTradeMap)
      .map(([name, tradeCount]) => ({ name, tradeCount }))
      .sort((a, b) => b.tradeCount - a.tradeCount)
      .slice(0, 8);

    const avgNetWorth =
      users.length > 0
        ? users.reduce((acc, u) => acc + (Number(u.netWorth) || 0), 0) / users.length
        : 0;

    return {
      totalUsers: users.length,
      totalTrades: trades.length,
      profitableUsers,
      activeUsers,
      avgTradesPerActiveUser,
      totalNotional,
      avgNetWorth,
      topTickers,
      tradesByWeekday,
      tradesByHour: hourMap,
      sideBreakdown: [
        { name: 'BUY', value: sideCounts.BUY },
        { name: 'SELL', value: sideCounts.SELL }
      ],
      topTraders
    };
  }, [users, trades]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <span>🛡️</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-500 text-xs">Competition management and trend analytics</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setConfirmAction({ type: 'resetAll' })}
          className="bg-red-900/30 hover:bg-red-900/50 text-accent-red border border-accent-red/30 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
        >
          🔄 Reset Entire Competition
        </button>

        <button onClick={exportTrades} className="btn-ghost text-sm border border-dark-500">
          📥 Export Trades CSV
        </button>

        <button onClick={loadData} className="btn-ghost text-sm">
          ↻ Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-dark-600">
        {[
          { key: 'users', label: `Users (${users.length})` },
          { key: 'trades', label: `All Trades (${trades.length})` },
          { key: 'stats', label: 'Stats & Trends' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-accent-blue text-white'
                : 'border-transparent text-gray-400 hover:text-white'
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
                {users.map((u) => {
                  const netWorth = Number(u.netWorth) || 0;
                  const pnl = netWorth - STARTING_BALANCE;
                  return (
                    <tr key={u.id} className="table-row">
                      <td className="py-2.5 pr-4">
                        <div className="font-semibold text-white">{u.teamName}</div>
                        <div className="text-gray-500 text-xs">{u.email}</div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-sm">
                        {formatCurrency(u.cashBalance || 0)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-accent-green">
                        {formatCurrency(netWorth)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-mono text-sm ${
                          pnl >= 0 ? 'text-accent-green' : 'text-accent-red'
                        }`}
                      >
                        {formatCurrency(pnl)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-400">
                        {u.totalTrades || 0}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() =>
                            setConfirmAction({ type: 'resetUser', userId: u.id, teamName: u.teamName })
                          }
                          className="text-xs text-accent-red hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                        >
                          Reset
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'trades' ? (
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
                {trades.map((trade) => {
                  const ts = trade.timestamp?.toDate?.() || new Date();
                  return (
                    <tr key={trade.id} className="table-row">
                      <td className="py-2.5 text-gray-400 text-xs">
                        {ts.toLocaleDateString()} {ts.toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 text-gray-300 text-xs">
                        {trade.userEmail || trade.userId?.slice(0, 8)}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            trade.buyOrSell === 'BUY'
                              ? 'bg-emerald-900/40 text-accent-green'
                              : 'bg-red-900/40 text-accent-red'
                          }`}
                        >
                          {trade.buyOrSell}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono font-bold text-accent-blue">{trade.ticker}</td>
                      <td className="py-2.5 text-right font-mono">{trade.quantity}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(trade.price)}</td>
                      <td className="py-2.5 text-right font-mono">
                        {formatCurrency(trade.totalValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-xs text-gray-500 mb-1">Total Users</div>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
            </div>
            <div className="card">
              <div className="text-xs text-gray-500 mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-white">{stats.totalTrades}</div>
            </div>
            <div className="card">
              <div className="text-xs text-gray-500 mb-1">Total Notional</div>
              <div className="text-2xl font-bold text-accent-blue">
                {formatCurrency(stats.totalNotional)}
              </div>
            </div>
            <div className="card">
              <div className="text-xs text-gray-500 mb-1">Profitable Teams</div>
              <div className="text-2xl font-bold text-accent-green">
                {stats.profitableUsers} / {stats.totalUsers}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card h-80">
              <h3 className="text-white font-semibold mb-3">Most Traded Tickers</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={stats.topTickers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="ticker" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#E5E7EB' }}
                    formatter={(value, name) => {
                      if (name === 'count') return [value, 'Trades'];
                      if (name === 'notional') return [formatCurrency(value), 'Notional'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card h-80">
              <h3 className="text-white font-semibold mb-3">Trading Activity by Weekday</h3>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={stats.tradesByWeekday}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#E5E7EB' }}
                    formatter={(value) => [value, 'Trades']}
                  />
                  <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card h-72">
              <h3 className="text-white font-semibold mb-3">Buy vs Sell Ratio</h3>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={stats.sideBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#EF4444" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#E5E7EB' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card h-72">
              <h3 className="text-white font-semibold mb-3">Most Active Trading Hours</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={stats.tradesByHour.filter((x) => x.count > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hour" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#E5E7EB' }}
                    formatter={(value) => [value, 'Trades']}
                  />
                  <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card h-72">
              <h3 className="text-white font-semibold mb-3">Top Active Teams</h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {stats.topTraders.length === 0 ? (
                  <p className="text-gray-500 text-sm">No trade activity yet.</p>
                ) : (
                  stats.topTraders.map((t, idx) => (
                    <div key={t.name} className="flex items-center justify-between border-b border-dark-600 pb-2">
                      <span className="text-gray-300 text-sm">
                        {idx + 1}. {t.name}
                      </span>
                      <span className="font-mono text-white text-sm">{t.tradeCount}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-dark-600 text-xs text-gray-400 space-y-1">
                <div>Active users: {stats.activeUsers}</div>
                <div>Avg trades per active user: {stats.avgTradesPerActiveUser.toFixed(2)}</div>
                <div>Avg net worth: {formatCurrency(stats.avgNetWorth)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-dark-700 border border-dark-500 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-3">Confirm Action</h3>
            {confirmAction.type === 'resetAll' ? (
              <p className="text-gray-400 text-sm mb-6">
                This will reset all users to {formatCurrency(STARTING_BALANCE)} and clear all portfolios and trades.
                This cannot be undone.
              </p>
            ) : (
              <p className="text-gray-400 text-sm mb-6">
                Reset <strong className="text-white">{confirmAction.teamName}</strong>? This will reset their cash to{' '}
                {formatCurrency(STARTING_BALANCE)} and clear their portfolio.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmAction.type === 'resetAll'
                    ? resetCompetition()
                    : resetUser(confirmAction.userId)
                }
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

