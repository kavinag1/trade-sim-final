import { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';
import { functions } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/market';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadLeaderboard();
    const interval = setInterval(loadLeaderboard, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      // Best-effort sync so this user's leaderboard entry is current.
      if (user?.uid) {
        try {
          const syncMyNetWorth = httpsCallable(functions, 'syncMyNetWorth');
          await syncMyNetWorth();
        } catch (syncErr) {
          console.error('Net worth sync failed:', syncErr);
        }
      }

      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('netWorth', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() }));
      setLeaders(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const myRank = leaders.find(l => l.id === user?.uid);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          {lastUpdated && (
            <p className="text-gray-500 text-xs mt-1">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button onClick={loadLeaderboard} disabled={loading} className="btn-ghost text-sm">
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* My rank */}
      {myRank && (
        <div className="card border-accent-blue/30 bg-accent-blue/5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-accent-blue">#{myRank.rank}</div>
              <div>
                <div className="font-semibold text-white">{myRank.teamName} (You)</div>
                <div className="text-gray-400 text-xs">{myRank.email}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xl font-bold text-accent-green">{formatCurrency(myRank.netWorth)}</div>
              <div className={`text-sm font-mono ${(myRank.netWorth - 100000) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {(myRank.netWorth - 100000) >= 0 ? '+' : ''}{formatCurrency(myRank.netWorth - 100000)} total P&L
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && leaders.length === 0 ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-dark-600">
                  <th className="text-left pb-3 w-12">Rank</th>
                  <th className="text-left pb-3">Team</th>
                  <th className="text-right pb-3">Net Worth</th>
                  <th className="text-right pb-3">Total P&L</th>
                  <th className="text-right pb-3">Trades</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((leader, i) => {
                  const pnl = (leader.netWorth || 0) - 100000;
                  const isMe = leader.id === user?.uid;

                  return (
                    <tr
                      key={leader.id}
                      className={`table-row ${isMe ? 'bg-accent-blue/5' : ''}`}
                    >
                      <td className="py-3 pr-4">
                        <div className={`font-bold text-center w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          i === 1 ? 'bg-gray-400/20 text-gray-300' :
                          i === 2 ? 'bg-amber-700/20 text-amber-600' :
                          'text-gray-400'
                        }`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${leader.rank}`}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-white flex items-center gap-2">
                          {leader.teamName || 'Unknown Team'}
                          {isMe && <span className="text-xs bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded">You</span>}
                        </div>
                        <div className="text-gray-500 text-xs">{leader.email}</div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-accent-green">
                        {formatCurrency(leader.netWorth || 0)}
                      </td>
                      <td className={`py-3 text-right font-mono ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </td>
                      <td className="py-3 text-right text-gray-400 font-mono">
                        {leader.totalTrades || 0}
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
