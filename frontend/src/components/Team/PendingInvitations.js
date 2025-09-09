import React from 'react';
import {
  Paper,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';

const PendingInvitations = ({ invitations, onCancel, onResend, onInviteUser }) => {
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  const getTimeLeft = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires - now;
    
    if (diff <= 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  };

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  if (pendingInvitations.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" gutterBottom>
            No Pending Invitations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            All invitations have been accepted or expired
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={onInviteUser}
          >
            Invite Someone
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <>
      <Paper>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Pending Invitations</Typography>
            <Typography variant="body2" color="text.secondary">
              {pendingInvitations.length} invitation{pendingInvitations.length > 1 ? 's' : ''} waiting for response
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={onInviteUser}
          >
            Invite More
          </Button>
        </Box>

        <List>
          {pendingInvitations.map((invitation) => (
            <ListItem key={invitation._id} divider>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1">{invitation.email}</Typography>
                    <Chip 
                      label={invitation.role} 
                      size="small" 
                      color={invitation.role === 'admin' ? 'info' : 'default'}
                    />
                    <Chip
                      icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                      label={getTimeLeft(invitation.expiresAt)}
                      size="small"
                      color={getTimeLeft(invitation.expiresAt) === 'Expired' ? 'error' : 'warning'}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Invited by {invitation.invitedBy?.firstName} {invitation.invitedBy?.lastName} on {formatDate(invitation.createdAt)}
                    </Typography>
                    {invitation.message && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        "{invitation.message}"
                      </Typography>
                    )}
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Tooltip title="Resend invitation email">
                  <IconButton 
                    edge="end" 
                    onClick={() => onResend(invitation._id)}
                    sx={{ mr: 1 }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel invitation">
                  <IconButton 
                    edge="end" 
                    onClick={() => onCancel(invitation._id)}
                    color="error"
                  >
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      {invitations.some(inv => inv.metadata?.requiresPayment) && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Some invitations require a subscription upgrade before they can be accepted
        </Alert>
      )}
    </>
  );
};

export default PendingInvitations;