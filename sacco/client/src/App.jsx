import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Savings from './pages/Savings';
import Loans from './pages/Loans';
import MySavings from './pages/MySavings';
import MyLoans from './pages/MyLoans';
import Profile from './pages/Profile';
import Requests from './pages/Requests';
import Guarantorship from './pages/Guarantorship';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Welfare from './pages/Welfare';
import Approvals from './pages/Approvals';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function OfficerOnly({ children }) {
  const { isOfficer } = useAuth();
  if (!isOfficer) return <Navigate to="/" replace />;
  return children;
}

function ChairOnly({ children }) {
  const { isChair } = useAuth();
  if (!isChair) return <Navigate to="/" replace />;
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
        <Route path="savings" element={<MySavings />} />
        <Route path="loans" element={<MyLoans />} />
        <Route path="profile" element={<Profile />} />
        <Route path="requests" element={<Requests />} />
        <Route path="guarantorship" element={<Guarantorship />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="messages" element={<Messages />} />
        <Route path="welfare" element={<Welfare />} />
        <Route
          path="credits/members"
          element={
            <OfficerOnly>
              <Members />
            </OfficerOnly>
          }
        />
        <Route
          path="credits/savings"
          element={
            <OfficerOnly>
              <Savings />
            </OfficerOnly>
          }
        />
        <Route
          path="credits/approvals"
          element={
            <ChairOnly>
              <Approvals />
            </ChairOnly>
          }
        />
        <Route
          path="credits/loans"
          element={
            <OfficerOnly>
              <Loans />
            </OfficerOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
