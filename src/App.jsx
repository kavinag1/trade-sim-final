import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MarketProvider } from './contexts/MarketContext';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import SearchPage from './pages/SearchPage';
import StockPage from './pages/StockPage';
import PortfolioPage from './pages/PortfolioPage';
import TradeHistoryPage from './pages/TradeHistoryPage';
import WatchlistPage from './pages/WatchlistPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage from './pages/AdminPage';
import SetupPage from './pages/SetupPage';
import SchoolBrand from './components/common/SchoolBrand';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <SchoolBrand />
        <div className="w-12 h-12 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400">Loading Fountainhead School Trading Competition...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="stock/:symbol" element={<StockPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="history" element={<TradeHistoryPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MarketProvider>
          <AppRoutes />
        </MarketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
