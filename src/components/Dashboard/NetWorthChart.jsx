import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatCurrency } from '../../utils/market';

export default function NetWorthChart({ userId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadSnapshots();
  }, [userId]);

  async function loadSnapshots() {
    try {
      const snapsRef = collection(db, 'portfolioSnapshots');
      const q = query(snapsRef, where('userId', '==', userId), orderBy('date', 'asc'));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({
        date: d.data().date,
        netWorth: d.data().netWorth,
      }));
      setData(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const latest = data.length ? data[data.length - 1].netWorth : 0;
  const oldest = data.length ? data[0].netWorth : 0;
  const change = latest - oldest;
  const changePct = oldest > 0 ? (change / oldest) * 100 : 0;

  return (
    <div className="card h-full min-h-[260px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Net Worth Snapshots</h3>
        {!!latest && <div className="text-xs text-gray-400">Latest: <span className="font-mono text-white">{formatCurrency(latest)}</span></div>}
      </div>
      {loading ? (
        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">Loading snapshots...</div>
      ) : data.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-gray-500 text-sm">
          <div className="text-3xl mb-2">📁</div>
          <p>Snapshot data appears after market close each day</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-600 rounded-lg p-3">
              <div className="text-xs text-gray-500">First Snapshot</div>
              <div className="text-sm font-mono text-white mt-1">{formatCurrency(oldest)}</div>
            </div>
            <div className="bg-dark-600 rounded-lg p-3">
              <div className="text-xs text-gray-500">Current Snapshot</div>
              <div className="text-sm font-mono text-white mt-1">{formatCurrency(latest)}</div>
            </div>
            <div className="bg-dark-600 rounded-lg p-3">
              <div className="text-xs text-gray-500">Change</div>
              <div className={`text-sm font-mono mt-1 ${change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePct.toFixed(2)}%)
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-dark-600">
                  <th className="text-left py-2">Date</th>
                  <th className="text-right py-2">Net Worth</th>
                </tr>
              </thead>
              <tbody>
                {data.slice().reverse().slice(0, 10).map((row) => (
                  <tr key={row.date} className="border-b border-dark-700/70">
                    <td className="py-2 text-gray-300">{row.date}</td>
                    <td className="py-2 text-right font-mono text-white">{formatCurrency(row.netWorth || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
