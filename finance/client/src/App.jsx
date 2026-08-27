import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import Expenses from './pages/Expenses';
import Vans from './pages/Vans';
import Mechanical from './pages/Mechanical';
import Fuel from './pages/Fuel';
import SearchPage from './pages/Search';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center muted">Loading…</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="income" element={<Income />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="vans" element={<Vans />} />
        <Route path="mechanical" element={<Mechanical />} />
        <Route path="fuel" element={<Fuel />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
