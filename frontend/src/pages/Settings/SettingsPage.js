import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import { 
  Settings as SettingsIcon, 
  Notifications as NotificationsIcon,
  People as PeopleIcon,
  AccountCircle as AccountIcon,
  CreditCard as BillingIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import TeamManagementPage from '../Team/TeamManagementPage';
import BillingPage from '../Billing/BillingPage';
import DeleteAccountDialog from '../../components/DeleteAccountDialog';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { user, tenant, refreshUserData } = useAuth();
  
  // Force refresh user data on mount
  React.useEffect(() => {
    console.log('🔄 [Settings] Mounting, refreshing user data...');
    refreshUserData().then(success => {
      if (success) {
        console.log('✅ [Settings] User data refreshed');
      } else {
        console.warn('❌ [Settings] Failed to refresh user data');
      }
    });
  }, [refreshUserData]);
  
  // Check if user can see team tab (Pro accounts + admin role)
  // Note: All Pro tenants have teams enabled by default
  const canManageTeam = ['owner', 'admin'].includes(user?.role) && 
                       user?.accountType === 'pro' && 
                       tenant?.subscription?.plan === 'pro';
  
  // Debug logging
  console.log('🔍 [Settings] Page Debug:', {
    user: {
      id: user?.id,
      email: user?.email,
      role: user?.role,
      accountType: user?.accountType,
      systemRole: user?.systemRole
    },
    tenant: {
      id: tenant?.id,
      name: tenant?.name,
      plan: tenant?.subscription?.plan,
      status: tenant?.subscription?.status,
      allowTeams: tenant?.limits?.allowTeams,
      currentProUsers: tenant?.limits?.currentProUsers
    },
    conditions: {
      isOwnerOrAdmin: ['owner', 'admin'].includes(user?.role),
      userIsPro: user?.accountType === 'pro',
      tenantIsPro: tenant?.subscription?.plan === 'pro',
      canManageTeam
    }
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <SettingsIcon sx={{ mr: 2, fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          Settings
        </Typography>
      </Box>

      {/* Tab Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<NotificationsIcon />} label="General" iconPosition="start" />
          {canManageTeam && (
            <Tab icon={<PeopleIcon />} label="Team" iconPosition="start" />
          )}
          <Tab icon={<AccountIcon />} label="Account" iconPosition="start" />
          <Tab icon={<BillingIcon />} label="Billing" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notifications
              </Typography>
              <FormControlLabel
                control={<Switch />}
                label="Email notifications"
                sx={{ display: 'block', mb: 2 }}
              />
              <FormControlLabel
                control={<Switch />}
                label="Processing completion alerts"
                sx={{ display: 'block' }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Processing
              </Typography>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Auto-generate tags"
                sx={{ display: 'block', mb: 2 }}
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Auto-generate todo items"
                sx={{ display: 'block' }}
              />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Team Tab - Only show for owners/admins */}
      {canManageTeam && activeTab === 1 && (
        <TeamManagementPage />
      )}

      {/* Account Tab */}
      {activeTab === (canManageTeam ? 2 : 1) && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Account Settings
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Danger Zone
            </Typography>
            <Button 
              variant="outlined" 
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={user?.role !== 'owner'}
            >
              Delete Account
            </Button>
            {user?.role !== 'owner' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Only account owners can delete accounts
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Account Dialog */}
      <DeleteAccountDialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)} 
      />

      {/* Billing Tab */}
      {activeTab === (canManageTeam ? 3 : 2) && (
        <BillingPage />
      )}
    </Container>
  );
};

export default SettingsPage;