import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';

// Code-splitting / Lazy loading secondary routes for instant mobile startup

const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const LoansPage = lazy(() => import('./pages/LoansPage'));
const LoanDetail = lazy(() => import('./pages/LoanDetail'));
const CreateLoan = lazy(() => import('./pages/CreateLoan'));
const CollectionPage = lazy(() => import('./pages/CollectionPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const ProfitPage = lazy(() => import('./pages/ProfitPage'));
const PaymentsHistoryPage = lazy(() => import('./pages/PaymentsHistoryPage'));

import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const PageLoader = () => (
  <div className="loading-page" style={{ minHeight: '60vh' }}>
    <div className="spinner" />
  </div>
);

function AppRoutes() {
  const { user, loading, isAdmin, isSuperAdmin } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /><p>Loading...</p></div>;
  if (!user) return <LoginPage />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={isSuperAdmin ? <SuperAdminDashboard /> : <Dashboard />} />
          <Route path="super-admin" element={isSuperAdmin ? <SuperAdminDashboard /> : <Navigate to="/" replace />} />
          <Route path="daybook" element={<Navigate to="/" replace />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="loans" element={<LoansPage />} />
          <Route path="loans/create" element={<CreateLoan />} />
          <Route path="loans/:id" element={<LoanDetail />} />
          <Route path="collections" element={<CollectionPage />} />
          <Route path="notifications" element={<Navigate to="/" replace />} />
          <Route path="users" element={<Navigate to="/" replace />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profit" element={<ProfitPage />} />
          <Route path="payment-history" element={<PaymentsHistoryPage />} />
          <Route path="collection-route" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              fontSize: '13px',
              maxWidth: '90vw',
              wordBreak: 'break-word',
            },
          }}
          containerStyle={{ top: 60 }}
          visibleToasts={2}
        />
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
