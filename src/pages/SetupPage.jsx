import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export default function SetupPage() {
  const { user, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState(userProfile?.teamName || '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { teamName: teamName.trim() });
      await refreshProfile();
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-2">Set your team name</h2>
        <p className="text-gray-400 text-sm mb-6">This name will appear on the leaderboard.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="Team name (e.g. Bull Market Bros)"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            maxLength={40}
          />
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Continue to Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}
