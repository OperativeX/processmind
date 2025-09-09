import React, { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  Select,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Star as StarIcon,
  Shield as ShieldIcon,
  Person as PersonIcon,
} from '@mui/icons-material';

const TeamMembersList = ({ 
  members, 
  currentUserId, 
  isOwner, 
  onUpdateRole, 
  onRemoveUser, 
  onInviteUser,
  limits 
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState('');

  const handleMenuClick = (event, user) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
    setNewRole(user.role);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleRemoveClick = () => {
    setRemoveDialogOpen(true);
    handleMenuClose();
  };

  const handleRoleClick = () => {
    setRoleDialogOpen(true);
    handleMenuClose();
  };

  const handleRemoveConfirm = async () => {
    if (selectedUser) {
      try {
        await onRemoveUser(selectedUser.id);
        setRemoveDialogOpen(false);
        setSelectedUser(null);
      } catch (error) {
        console.error('Failed to remove user:', error);
        // Keep dialog open on error so user can see what happened
      }
    }
  };

  const handleRoleUpdate = async () => {
    if (selectedUser && newRole !== selectedUser.role) {
      await onUpdateRole(selectedUser.id, newRole);
    }
    setRoleDialogOpen(false);
    setSelectedUser(null);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner':
        return <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
      case 'admin':
        return <ShieldIcon sx={{ fontSize: 16, color: 'info.main' }} />;
      default:
        return <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return 'warning';
      case 'admin':
        return 'info';
      default:
        return 'default';
    }
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const canEditUser = (user) => {
    // Can't edit yourself
    if (user.id === currentUserId) return false;
    // Only owners can edit other users
    if (!isOwner) return false;
    // Can't edit other owners
    if (user.role === 'owner') return false;
    return true;
  };

  return (
    <>
      <Paper>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Team Members</Typography>
            <Typography variant="body2" color="text.secondary">
              {members.length} of {limits?.maxUsers === -1 ? 'unlimited' : limits?.maxUsers} members
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={onInviteUser}
            disabled={limits?.maxUsers !== -1 && members.length >= limits?.maxUsers}
          >
            Invite Member
          </Button>
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {getInitials(member.firstName, member.lastName)}
                      </Avatar>
                      <Box>
                        <Typography variant="body1">
                          {member.firstName} {member.lastName}
                          {member.id === currentUserId && (
                            <Chip label="You" size="small" sx={{ ml: 1 }} />
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Chip
                      icon={getRoleIcon(member.role)}
                      label={member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      size="small"
                      color={getRoleColor(member.role)}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    {canEditUser(member) && (
                      <IconButton onClick={(e) => handleMenuClick(e, member)}>
                        <MoreVertIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRoleClick}>Change Role</MenuItem>
        <MenuItem onClick={handleRemoveClick} sx={{ color: 'error.main' }}>
          Remove from Team
        </MenuItem>
      </Menu>

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onClose={() => setRemoveDialogOpen(false)}>
        <DialogTitle>Remove Team Member?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> from the team?
            They will lose access to all team resources immediately.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRemoveConfirm} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
        <DialogTitle>Change Role</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Change role for <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong>
          </DialogContentText>
          <FormControl fullWidth>
            <Select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <MenuItem value="admin">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShieldIcon sx={{ fontSize: 20 }} />
                  Admin - Can manage team and content
                </Box>
              </MenuItem>
              <MenuItem value="user">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon sx={{ fontSize: 20 }} />
                  User - Can manage own content only
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRoleUpdate} variant="contained">
            Update Role
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TeamMembersList;