import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

import { useAuth } from './contexts/AuthContext';
import { UploadProvider } from './contexts/UploadContext';
import Layout from './components/Layout/Layout';
import LoadingScreen from './components/Common/LoadingScreen';
import ErrorBoundary from './components/Common/ErrorBoundary';
import ShareNotificationDialog from './components/Notifications/ShareNotificationDialog';
import StripeProvider from './components/Billing/StripeProvider';
import { notificationAPI } from './services/api';

// Page imports
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import VerifyRegistrationPage from './pages/Auth/VerifyRegistrationPage';
import AcceptInvitationPage from './pages/Auth/AcceptInvitationPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import UploadPage from './pages/Upload/UploadPage';
import ProcessPage from './pages/Process/ProcessPage';
import ProcessListPage from './pages/Process/ProcessListPage';
import GraphViewPage from './pages/Graph/GraphViewPage';
import FavoriteListsPage from './pages/FavoriteList/FavoriteListsPage';
import FavoriteListDetailPage from './pages/FavoriteList/FavoriteListDetailPage';
import SettingsPage from './pages/Settings/SettingsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import BillingPage from './pages/Billing/BillingPage';
import SharedProcessPage from './pages/Shared/SharedProcessPage';
import AcceptSharePage from './pages/Share/AcceptSharePage';
import RejectSharePage from './pages/Share/RejectSharePage';
import NotFoundPage from './pages/Error/NotFoundPage';

// Public Page imports
import LandingPage from './pages/Public/LandingPage';
import FeaturesPage from './pages/Public/FeaturesPage';
import PricingPage from './pages/Public/PricingPage';
import AboutPage from './pages/Public/AboutPage';
import ContactPage from './pages/Public/ContactPage';
import PrivacyPage from './pages/Public/PrivacyPage';
import TermsPage from './pages/Public/TermsPage';

// Super Admin imports
import SuperAdminLogin from './pages/SuperAdmin/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdmin/SuperAdminDashboard';
import SuperAdminTenants from './pages/SuperAdmin/SuperAdminTenants';
import SuperAdminTenantDetails from './pages/SuperAdmin/SuperAdminTenantDetails';
import SuperAdminAnalytics from './pages/SuperAdmin/SuperAdminAnalytics';
import SuperAdminPricing from './pages/SuperAdmin/SuperAdminPricing';
import SuperAdminSettings from './pages/SuperAdmin/SuperAdminSettings';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, user, tenant } = useAuth();

  console.log('🛡️ [ProtectedRoute] Evaluating access:', {
    isLoading,
    isAuthenticated, 
    hasUser: !!user,
    hasTenant: !!tenant,
    userEmail: user?.email,
    tenantId: tenant?.id,
    tenantName: tenant?.name,
    currentPath: window.location.pathname
  });

  if (isLoading) {
    console.log('⏳ [ProtectedRoute] Still loading, showing loading screen');
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    console.log('🚪 [ProtectedRoute] Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (!tenant) {
    console.log('❌ [ProtectedRoute] Authenticated but no tenant context, showing error');
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Authentication Error
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your account is missing tenant information. Please log in again.
        </Typography>
        <Box sx={{ mt: 2 }}>
          <button onClick={() => window.location.href = '/login'}>
            Go to Login
          </button>
        </Box>
      </Box>
    );
  }

  console.log('✅ [ProtectedRoute] Access granted with tenant context:', tenant.name);
  return children;
};

// Public Route Component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  console.log('🌍 [PublicRoute] Evaluating public access:', {
    isLoading,
    isAuthenticated,
    hasUser: !!user,
    currentPath: window.location.pathname
  });

  if (isLoading) {
    console.log('⏳ [PublicRoute] Still loading, showing loading screen');
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    console.log('🔄 [PublicRoute] Already authenticated, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ [PublicRoute] Showing public content');
  return children;
};

function App() {
  const { isLoading, isAuthenticated, user, tenant } = useAuth();
  const location = useLocation();
  const [shareNotificationOpen, setShareNotificationOpen] = useState(false);
  const [hasCheckedNotifications, setHasCheckedNotifications] = useState(() => {
    // Check if we already checked in this session to avoid repeated checks
    return sessionStorage.getItem('pendingSharesChecked') === 'true';
  });

  // Check for pending share notifications after login
  useEffect(() => {
    const checkPendingShares = async () => {
      try {
        const response = await notificationAPI.getPendingShares(tenant.id);
        const pendingShares = response.data.data;
        
        // Only open dialog if there are actual pending shares
        if (pendingShares && pendingShares.length > 0) {
          setShareNotificationOpen(true);
        }
        setHasCheckedNotifications(true);
        sessionStorage.setItem('pendingSharesChecked', 'true');
      } catch (error) {
        console.error('Error checking pending shares:', error);
        setHasCheckedNotifications(true);
        sessionStorage.setItem('pendingSharesChecked', 'true');
      }
    };

    if (isAuthenticated && user && tenant && !hasCheckedNotifications && 
        !location.pathname.startsWith('/shared/') && 
        !location.pathname.startsWith('/super-admin/')) {
      // Small delay to ensure smooth transition after login
      const timer = setTimeout(checkPendingShares, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, tenant, hasCheckedNotifications, location.pathname]);

  // Reset notification check state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setHasCheckedNotifications(false);
      sessionStorage.removeItem('pendingSharesChecked');
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <StripeProvider>
        <UploadProvider>
          <Box
            sx={{
              minHeight: '100vh',
              backgroundColor: 'background.default',
              color: 'text.primary',
            }}
          >
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          
          {/* Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />
          <Route
            path="/verify-registration"
            element={
              <PublicRoute>
                <VerifyRegistrationPage />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPasswordPage />
              </PublicRoute>
            }
          />

          {/* Invitation Route (no auth required) */}
          <Route
            path="/join/:token"
            element={
              <PublicRoute>
                <AcceptInvitationPage />
              </PublicRoute>
            }
          />

          {/* Shared Process Route (no auth required) */}
          <Route path="/shared/:shareId" element={<SharedProcessPage />} />
          
          {/* Accept/Reject Share Routes */}
          <Route path="/accept-share/:shareId" element={<AcceptSharePage />} />
          <Route path="/reject-share/:shareId" element={<RejectSharePage />} />

          {/* Super Admin Routes (separate auth) */}
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/tenants" element={<SuperAdminTenants />} />
          <Route path="/super-admin/tenants/:id" element={<SuperAdminTenantDetails />} />
          <Route path="/super-admin/analytics" element={<SuperAdminAnalytics />} />
          <Route path="/super-admin/pricing" element={<SuperAdminPricing />} />
          <Route path="/super-admin/settings" element={<SuperAdminSettings />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <Layout>
                  <UploadPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/processes"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProcessListPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-processes"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProcessListPage userFilter={true} />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/processes/:processId"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProcessPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/graph"
            element={
              <ProtectedRoute>
                <Layout>
                  <GraphViewPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Layout>
                  <FavoriteListsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <FavoriteListDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <SettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Layout>
                  <BillingPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        
        {/* Share Notification Dialog */}
        {isAuthenticated && (
          <ShareNotificationDialog
            open={shareNotificationOpen}
            onClose={() => setShareNotificationOpen(false)}
          />
        )}
          </Box>
        </UploadProvider>
      </StripeProvider>
    </ErrorBoundary>
  );
}

export default App;