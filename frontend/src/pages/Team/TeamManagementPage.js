import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { teamAPI } from '../../services/api';
import TeamMembersList from '../../components/Team/TeamMembersList';
import PendingInvitations from '../../components/Team/PendingInvitations';
import InviteUserDialog from '../../components/Team/InviteUserDialog';

const TeamManagementPage = () => {
  const { user, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Team data
  const [teamMembers, setTeamMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [limits, setLimits] = useState(null);
  const [billingStatus, setBillingStatus] = useState(null);
  
  // Dialog states
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check permissions
  const canManageTeam = ['owner', 'admin'].includes(user?.role);
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (canManageTeam) {
      loadTeamData();
    }
  }, [tenant?.id, refreshTrigger]);

  const loadTeamData = async () => {
    if (!tenant?.id) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Load all team data in parallel
      const [membersRes, invitationsRes, billingRes] = await Promise.all([
        teamAPI.getTeamMembers(tenant.id),
        teamAPI.getInvitations(tenant.id),
        teamAPI.getBillingStatus(tenant.id)
      ]);
      
      setTeamMembers(membersRes.data.data.users);
      setLimits(membersRes.data.data.limits);
      setInvitations(invitationsRes.data.data);
      setBillingStatus(billingRes.data.data);
    } catch (err) {
      console.error('Error loading team data:', err);
      setError('Failed to load team information');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleInviteUser = async (inviteData) => {
    try {
      await teamAPI.inviteUser(tenant.id, inviteData);
      setRefreshTrigger(prev => prev + 1);
      setInviteDialogOpen(false);
    } catch (err) {
      throw err;
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    try {
      await teamAPI.cancelInvitation(tenant.id, invitationId);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError('Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      await teamAPI.resendInvitation(tenant.id, invitationId);
      // Show success message
    } catch (err) {
      setError('Failed to resend invitation');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await teamAPI.updateUserRole(tenant.id, userId, newRole);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError('Failed to update user role');
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await teamAPI.removeUser(tenant.id, userId);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      setError('Failed to remove user');
    }
  };

  if (!canManageTeam) {
    return (
      <Alert severity="warning">
        You don't have permission to manage team members.
      </Alert>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Billing Alert */}
      {billingStatus && billingStatus.nextUserPrice > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Adding another team member will cost €{billingStatus.nextUserPrice}/month
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab 
            icon={<PeopleIcon />} 
            label={`Team Members (${teamMembers.length})`} 
            iconPosition="start" 
          />
          <Tab 
            icon={<PersonAddIcon />} 
            label={`Invitations (${invitations.length})`} 
            iconPosition="start" 
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && (
          <TeamMembersList
            members={teamMembers}
            currentUserId={user.id}
            isOwner={isOwner}
            onUpdateRole={handleUpdateRole}
            onRemoveUser={handleRemoveUser}
            onInviteUser={() => setInviteDialogOpen(true)}
            limits={limits}
          />
        )}
        
        {activeTab === 1 && (
          <PendingInvitations
            invitations={invitations}
            onCancel={handleCancelInvitation}
            onResend={handleResendInvitation}
            onInviteUser={() => setInviteDialogOpen(true)}
          />
        )}
      </Box>

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        onInvite={handleInviteUser}
        billingStatus={billingStatus}
        tenantId={tenant?.id}
      />
    </Box>
  );
};

export default TeamManagementPage;