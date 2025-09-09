import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  FormGroup,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  InputAdornment
} from '@mui/material';
import {
  Settings,
  Security,
  Storage,
  Api,
  Warning,
  Check,
  Add,
  Delete,
  Edit,
  CloudUpload,
  Speed,
  Lock,
  Notifications
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import SuperAdminLayout from '../../components/SuperAdmin/SuperAdminLayout';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  marginBottom: theme.spacing(3)
}));

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  marginBottom: theme.spacing(2)
}));

const SuperAdminSettings = () => {
  const [settings, setSettings] = useState({
    // System Settings
    maintenanceMode: false,
    maintenanceMessage: '',
    allowRegistrations: true,
    requireEmailVerification: true,
    
    // API Limits
    maxUploadSize: 500, // MB
    maxProcessesPerMonth: 100,
    maxUsersPerTenant: 50,
    apiRateLimit: 100, // requests per minute
    
    // Storage Settings
    storageProvider: 'local',
    maxStoragePerTenant: 10240, // MB
    autoDeleteAfterDays: 90,
    
    // Security Settings
    enforceStrongPasswords: true,
    sessionTimeout: 7200, // seconds
    maxLoginAttempts: 5,
    ipWhitelist: [],
    
    // Notification Settings
    systemEmails: true,
    alertOnHighUsage: true,
    usageAlertThreshold: 80 // percentage
  });

  const [ipDialog, setIpDialog] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSettingChange = (category, setting, value) => {
    setSettings({
      ...settings,
      [setting]: value
    });
  };

  const handleSave = () => {
    // In a real implementation, this would save to the backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddIp = () => {
    if (newIp && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(newIp)) {
      setSettings({
        ...settings,
        ipWhitelist: [...settings.ipWhitelist, newIp]
      });
      setNewIp('');
      setIpDialog(false);
    } else {
      setError('Invalid IP address format');
    }
  };

  const handleRemoveIp = (ip) => {
    setSettings({
      ...settings,
      ipWhitelist: settings.ipWhitelist.filter(item => item !== ip)
    });
  };

  return (
    <SuperAdminLayout>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            System Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure system-wide settings and limits
          </Typography>
        </Box>

        {saved && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Settings saved successfully
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* General Settings */}
          <Grid item xs={12} lg={6}>
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Settings sx={{ color: '#7c3aed' }} />
                <Typography variant="h6">
                  General Settings
                </Typography>
              </Box>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.maintenanceMode}
                      onChange={(e) => handleSettingChange('general', 'maintenanceMode', e.target.checked)}
                      color="error"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Maintenance Mode
                      {settings.maintenanceMode && (
                        <Chip label="Active" color="error" size="small" />
                      )}
                    </Box>
                  }
                />
                
                {settings.maintenanceMode && (
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Maintenance Message"
                    value={settings.maintenanceMessage}
                    onChange={(e) => handleSettingChange('general', 'maintenanceMessage', e.target.value)}
                    sx={{ mt: 2, mb: 2 }}
                  />
                )}

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.allowRegistrations}
                      onChange={(e) => handleSettingChange('general', 'allowRegistrations', e.target.checked)}
                    />
                  }
                  label="Allow New Registrations"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.requireEmailVerification}
                      onChange={(e) => handleSettingChange('general', 'requireEmailVerification', e.target.checked)}
                    />
                  }
                  label="Require Email Verification"
                />
              </FormGroup>
            </StyledPaper>

            {/* Storage Settings */}
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Storage sx={{ color: '#3b82f6' }} />
                <Typography variant="h6">
                  Storage Settings
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Max Storage Per Tenant"
                    type="number"
                    value={settings.maxStoragePerTenant}
                    onChange={(e) => handleSettingChange('storage', 'maxStoragePerTenant', parseInt(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">MB</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Auto Delete Files After"
                    type="number"
                    value={settings.autoDeleteAfterDays}
                    onChange={(e) => handleSettingChange('storage', 'autoDeleteAfterDays', parseInt(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">days</InputAdornment>
                    }}
                    helperText="Set to 0 to disable auto-deletion"
                  />
                </Grid>
              </Grid>
            </StyledPaper>
          </Grid>

          {/* API & Limits */}
          <Grid item xs={12} lg={6}>
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Api sx={{ color: '#10b981' }} />
                <Typography variant="h6">
                  API & Limits
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Max Upload Size"
                    type="number"
                    value={settings.maxUploadSize}
                    onChange={(e) => handleSettingChange('api', 'maxUploadSize', parseInt(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">MB</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Max Processes Per Month"
                    type="number"
                    value={settings.maxProcessesPerMonth}
                    onChange={(e) => handleSettingChange('api', 'maxProcessesPerMonth', parseInt(e.target.value))}
                    helperText="Per tenant limit"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Max Users Per Tenant"
                    type="number"
                    value={settings.maxUsersPerTenant}
                    onChange={(e) => handleSettingChange('api', 'maxUsersPerTenant', parseInt(e.target.value))}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="API Rate Limit"
                    type="number"
                    value={settings.apiRateLimit}
                    onChange={(e) => handleSettingChange('api', 'apiRateLimit', parseInt(e.target.value))}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">req/min</InputAdornment>
                    }}
                  />
                </Grid>
              </Grid>
            </StyledPaper>

            {/* Security Settings */}
            <StyledPaper>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Security sx={{ color: '#ef4444' }} />
                <Typography variant="h6">
                  Security Settings
                </Typography>
              </Box>

              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enforceStrongPasswords}
                      onChange={(e) => handleSettingChange('security', 'enforceStrongPasswords', e.target.checked)}
                    />
                  }
                  label="Enforce Strong Passwords"
                />

                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Session Timeout"
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">sec</InputAdornment>
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Max Login Attempts"
                      type="number"
                      value={settings.maxLoginAttempts}
                      onChange={(e) => handleSettingChange('security', 'maxLoginAttempts', parseInt(e.target.value))}
                    />
                  </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2">
                      IP Whitelist ({settings.ipWhitelist.length})
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={() => setIpDialog(true)}
                    >
                      Add IP
                    </Button>
                  </Box>

                  {settings.ipWhitelist.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No IP restrictions (all IPs allowed)
                    </Typography>
                  ) : (
                    <List dense>
                      {settings.ipWhitelist.map((ip, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={ip} />
                          <ListItemSecondaryAction>
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveIp(ip)}
                            >
                              <Delete />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </FormGroup>
            </StyledPaper>
          </Grid>

          {/* System Status */}
          <Grid item xs={12}>
            <StyledPaper>
              <Typography variant="h6" sx={{ mb: 3 }}>
                System Status
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <StyledCard>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Speed sx={{ color: '#10b981' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            API Status
                          </Typography>
                          <Typography variant="h6">
                            Operational
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </StyledCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <StyledCard>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Storage sx={{ color: '#3b82f6' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Storage Used
                          </Typography>
                          <Typography variant="h6">
                            45.2 GB
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </StyledCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <StyledCard>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Api sx={{ color: '#f59e0b' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            API Calls Today
                          </Typography>
                          <Typography variant="h6">
                            12,456
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </StyledCard>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <StyledCard>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Lock sx={{ color: '#ef4444' }} />
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Failed Logins
                          </Typography>
                          <Typography variant="h6">
                            23
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </StyledCard>
                </Grid>
              </Grid>
            </StyledPaper>
          </Grid>
        </Grid>

        {/* Save Button */}
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Check />}
            onClick={handleSave}
            sx={{
              backgroundColor: '#7c3aed',
              '&:hover': {
                backgroundColor: '#6d28d9'
              },
              px: 4
            }}
          >
            Save All Settings
          </Button>
        </Box>

        {/* IP Dialog */}
        <Dialog open={ipDialog} onClose={() => setIpDialog(false)}>
          <DialogTitle>Add IP to Whitelist</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="IP Address"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="192.168.1.100"
              error={!!error}
              helperText={error}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIpDialog(false)}>Cancel</Button>
            <Button onClick={handleAddIp} variant="contained">Add</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </SuperAdminLayout>
  );
};

export default SuperAdminSettings;