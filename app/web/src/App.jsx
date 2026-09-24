import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/auth.jsx';
import { AppShell } from './components/AppShell.jsx';
import { EmptyState, Button, Skeleton } from './components/ui.jsx';
import { Login } from './screens/Login.jsx';
import { Dashboard } from './screens/Dashboard.jsx';
import { VoteForm } from './screens/VoteForm.jsx';
import { MyVotes } from './screens/MyVotes.jsx';
import { Results } from './screens/Results.jsx';
import { AdminCycles } from './screens/AdminCycles.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route element={<Protected><AppShell /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="vote/month" element={<VoteForm awardType="Month" />} />
            <Route path="vote/year" element={<VoteForm awardType="Year" />} />
            <Route path="my-votes" element={<MyVotes />} />
            <Route path="results" element={<Results />} />
            <Route path="admin/cycles" element={<AdminOnly><AdminCycles /></AdminOnly>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Booting />;
  // The originally requested path is preserved so sign-in returns you there
  // rather than blindly to the dashboard.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Booting />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

/**
 * Role gate. NF-3 — this hides the screen; the API refuses the routes
 * regardless, so a hand-typed URL gets a 403 from the server, not just here.
 */
function AdminOnly({ children }) {
  const { isPrivileged } = useAuth();
  if (!isPrivileged) {
    return (
      <EmptyState
        title="You don't have access to this page"
        body="Administration is limited to HR. If you think this is wrong, contact your administrator."
        action={<Button as="a" href="/" variant="primary">Back to Dashboard</Button>}
      />
    );
  }
  return children;
}

function NotFound() {
  return (
    <EmptyState
      title="We could not find that page"
      body="The link may be out of date, or the screen may belong to a later phase of the build."
      action={<Button as="a" href="/" variant="primary">Back to Dashboard</Button>}
    />
  );
}

function Booting() {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720, margin: '0 auto' }}>
      <Skeleton h={40} w="40%" />
      <Skeleton h={120} />
      <Skeleton h={220} />
    </div>
  );
}
