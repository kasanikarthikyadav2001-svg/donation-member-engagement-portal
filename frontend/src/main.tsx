import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider, useAuth, isStaff } from "./hooks/auth";
import { Layout } from "./components/Layout";
import { Skeleton, ErrorState, Empty } from "./components/ui";
import { AuthPage, RecoveryPage, Privacy } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { People } from "./pages/People";
import { Donations } from "./pages/Donations";
import { DummyCheckout } from "./pages/DummyCheckout";
import { Surveys } from "./pages/Surveys";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Administration } from "./pages/Administration";
import "./styles.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: true },
  },
});
function Protected() {
  const { user, loading, error, refresh } = useAuth();
  if (loading)
    return (
      <div className="initial-loading">
        <Skeleton rows={3} />
      </div>
    );
  if (error) return <ErrorState error={error} retry={refresh} />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function StaffOnly({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  return (admin ? user?.role === "admin" : isStaff(user)) ? (
    <Outlet />
  ) : (
    <Navigate to="/" replace />
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="recovery-shell">
        <div className="auth-card">
          <h1>Something went wrong</h1>
          <p>Please reload the portal to continue.</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload portal
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage register />} />
              <Route path="/forgot-password" element={<RecoveryPage />} />
              <Route path="/reset-password" element={<RecoveryPage reset />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route element={<Protected />}>
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="donations" element={<Donations />} />
                  <Route path="checkout/:id" element={<DummyCheckout />} />
                  <Route path="surveys" element={<Surveys />} />
                  <Route path="settings" element={<Settings />} />
                  <Route element={<StaffOnly />}>
                    <Route path="people" element={<People />} />
                    <Route path="reports" element={<Reports />} />
                  </Route>
                  <Route element={<StaffOnly admin />}>
                    <Route path="administration" element={<Administration />} />
                  </Route>
                  <Route
                    path="*"
                    element={
                      <Empty
                        title="Page not found"
                        description="This page is unavailable."
                        action={
                          <Link to="/" className="btn btn-primary">
                            Back to overview
                          </Link>
                        }
                      />
                    }
                  />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
        <Toaster richColors closeButton position="bottom-right" />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
