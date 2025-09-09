import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack,
  Business,
  People,
  VideoLibrary,
  AttachMoney,
  Storage,
  Edit,
  Save,
  Cancel,
  PowerSettingsNew,
  Email,
  Warning,
  CheckCircle,
  TrendingUp,
  AccessTime,
  Block,
  Star
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import SuperAdminLayout from '../../components/SuperAdmin/SuperAdminLayout';
import { superAdminService } from '../../services/superAdminService';
import { formatCurrency, formatDate, formatBytes, formatRelativeTime } from '../../utils/formatters';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d'
}));

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  height: '100%'
}));

const TabPanel = ({ children, value, index }) => (
  <Box hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

const SuperAdminTenantDetails = () => {
  const { id: tenantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editingPricing, setEditingPricing] = useState(false);
  const [messageDialog, setMessageDialog] = useState(false);
  const [message, setMessage] = useState({ subject: '', message: '', sendToAllUsers: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Pricing form state
  const [pricingForm, setPricingForm] = useState({
    enabled: false,
    pricePerUser: 10,
    freeUsers: 1,
    maxUsers: -1,
    notes: ''
  });

  useEffect(() => {
    loadTenantDetails();
  }, [tenantId]);

  const loadTenantDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Validate tenant ID format
      if (!tenantId || !tenantId.match(/^[0-9a-fA-F]{24}$/)) {
        setError('Invalid tenant ID format');
        setLoading(false);
        return;
      }
      
      const [tenantRes, statsRes] = await Promise.all([
        superAdminService.getTenantDetails(tenantId),
        superAdminService.getTenantStats(tenantId, 30)
      ]);

      setTenant(tenantRes.tenant);
      setStats(statsRes.stats);
      
      // Initialize pricing form
      if (tenantRes.tenant.billing?.customPricing) {
        setPricingForm({
          enabled: tenantRes.tenant.billing.customPricing.enabled,
          pricePerUser: tenantRes.tenant.billing.customPricing.pricePerUser || 10,
          freeUsers: tenantRes.tenant.billing.customPricing.freeUsers || 1,
          maxUsers: tenantRes.tenant.limits?.maxUsers || -1,
          notes: tenantRes.tenant.billing.customPricing.notes || ''
        });
      }
    } catch (err) {
      console.error('Load tenant details error:', err);
      setError('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      await superAdminService.updateTenantStatus(tenantId, {
        isActive: !tenant.isActive,
        reason: `Status changed by super admin`
      });
      setSuccess('Tenant status updated successfully');
      loadTenantDetails();
    } catch (err) {
      console.error('Toggle status error:', err);
      setError('Failed to update tenant status');
    }
  };

  const handleSavePricing = async () => {
    try {
      await superAdminService.updateTenantPricing(tenantId, pricingForm);
      setSuccess('Pricing updated successfully');
      setEditingPricing(false);
      loadTenantDetails();
    } catch (err) {
      console.error('Save pricing error:', err);
      setError('Failed to save pricing');
    }
  };

  const handleSendMessage = async () => {
    try {
      await superAdminService.sendMessageToTenant(tenantId, message);
      setSuccess('Message sent successfully');
      setMessageDialog(false);
      setMessage({ subject: '', message: '', sendToAllUsers: false });
    } catch (err) {
      console.error('Send message error:', err);
      setError('Failed to send message');
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </SuperAdminLayout>
    );
  }

  if (!tenant) {
    return (
      <SuperAdminLayout>
        <Container>
          <Alert severity="error">Tenant not found</Alert>
        </Container>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/super-admin/tenants')}
            sx={{ mb: 2 }}
          >
            Back to Tenants
          </Button>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Business sx={{ fontSize: 40, color: '#7c3aed' }} />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {tenant.name}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {tenant.domain || 'No domain configured'}
                </Typography>
              </Box>
              <Chip
                label={tenant.isActive ? 'Active' : 'Inactive'}
                color={tenant.isActive ? 'success' : 'error'}
                size="medium"
              />
            </Box>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                startIcon={<Email />}
                variant="outlined"
                onClick={() => setMessageDialog(true)}
              >
                Send Message
              </Button>
              <Button
                startIcon={<PowerSettingsNew />}
                variant="contained"
                color={tenant.isActive ? 'error' : 'success'}
                onClick={handleToggleStatus}
              >
                {tenant.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Users
                  </Typography>
                  <People sx={{ color: '#3b82f6' }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {tenant.metrics?.userCount || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tenant.limits?.maxUsers === -1 ? 'Unlimited' : `Limit: ${tenant.limits?.maxUsers}`}
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Processes
                  </Typography>
                  <VideoLibrary sx={{ color: '#10b981' }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {tenant.metrics?.processCount || 0}
                </Typography>
                <Typography variant="caption" color="success.main">
                  +{stats?.totals?.newProcesses || 0} this month
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Monthly Revenue
                  </Typography>
                  <AttachMoney sx={{ color: '#f59e0b' }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatCurrency(tenant.metrics?.monthlyRevenue || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tenant.metrics?.billableUsers || 0} billable users
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Storage Used
                  </Typography>
                  <Storage sx={{ color: '#ef4444' }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatBytes(tenant.metrics?.storageUsedMB * 1024 * 1024 || 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  of {formatBytes(tenant.limits?.maxStorage || 10737418240)}
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>
        </Grid>

        {/* Tabs */}
        <StyledPaper>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            sx={{ borderBottom: '1px solid #30363d' }}
          >
            <Tab label="Users" />
            <Tab label="Processes" />
            <Tab label="Billing & Pricing" />
            <Tab label="Statistics" />
            <Tab label="Settings" />
          </Tabs>

          {/* Users Tab */}
          <TabPanel value={activeTab} index={0}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Joined</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tenant.users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: '#7c3aed' }}>
                            {user.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body1">{user.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          size="small"
                          icon={user.role === 'owner' ? <Star /> : undefined}
                          color={user.role === 'owner' ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label="Active"
                          size="small"
                          color="success"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small">
                          <Block />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Processes Tab */}
          <TabPanel value={activeTab} index={1}>
            <List>
              {tenant.metrics?.recentProcesses?.map((process) => (
                <ListItem key={process.id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: process.status === 'completed' ? '#10b981' : '#f59e0b' }}>
                      <VideoLibrary />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={process.title}
                    secondary={formatRelativeTime(process.createdAt)}
                  />
                  <Chip
                    label={process.status}
                    size="small"
                    color={process.status === 'completed' ? 'success' : 'warning'}
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          {/* Billing Tab */}
          <TabPanel value={activeTab} index={2}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Pricing Configuration</Typography>
              {!editingPricing ? (
                <Button startIcon={<Edit />} onClick={() => setEditingPricing(true)}>
                  Edit Pricing
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button startIcon={<Cancel />} onClick={() => setEditingPricing(false)}>
                    Cancel
                  </Button>
                  <Button startIcon={<Save />} variant="contained" onClick={handleSavePricing}>
                    Save Changes
                  </Button>
                </Box>
              )}
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={pricingForm.enabled}
                      onChange={(e) => setPricingForm({ ...pricingForm, enabled: e.target.checked })}
                      disabled={!editingPricing}
                    />
                  }
                  label="Enable Custom Pricing"
                />
              </Grid>

              {pricingForm.enabled && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Price Per User (EUR)"
                      type="number"
                      value={pricingForm.pricePerUser}
                      onChange={(e) => setPricingForm({ ...pricingForm, pricePerUser: parseFloat(e.target.value) })}
                      disabled={!editingPricing}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">€</InputAdornment>
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Free Users"
                      type="number"
                      value={pricingForm.freeUsers}
                      onChange={(e) => setPricingForm({ ...pricingForm, freeUsers: parseInt(e.target.value) })}
                      disabled={!editingPricing}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Max Users (-1 for unlimited)"
                      type="number"
                      value={pricingForm.maxUsers}
                      onChange={(e) => setPricingForm({ ...pricingForm, maxUsers: parseInt(e.target.value) })}
                      disabled={!editingPricing}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Internal Notes"
                      multiline
                      rows={3}
                      value={pricingForm.notes}
                      onChange={(e) => setPricingForm({ ...pricingForm, notes: e.target.value })}
                      disabled={!editingPricing}
                      helperText="e.g., Beta Tester, Partner, Special Deal"
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" sx={{ mb: 2 }}>Current Billing</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Billing Email</Typography>
                <Typography variant="body1">{tenant.subscription?.billingEmail || 'Not set'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Subscription Plan</Typography>
                <Typography variant="body1">{tenant.subscription?.plan || 'Free'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Billable Users</Typography>
                <Typography variant="body1">{tenant.metrics?.billableUsers || 0}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">Monthly Revenue</Typography>
                <Typography variant="body1">{formatCurrency(tenant.metrics?.monthlyRevenue || 0)}</Typography>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Statistics Tab */}
          <TabPanel value={activeTab} index={3}>
            {stats && (
              <>
                <Typography variant="h6" sx={{ mb: 3 }}>Usage Statistics (Last 30 Days)</Typography>
                
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">New Processes</Typography>
                        <Typography variant="h4">{stats.totals.newProcesses}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">API Calls</Typography>
                        <Typography variant="h4">{stats.totals.apiCalls}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">Transcription Minutes</Typography>
                        <Typography variant="h4">{stats.totals.transcriptionMinutes}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}>
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">Estimated Cost</Typography>
                        <Typography variant="h4">{formatCurrency(stats.totals.estimatedCost)}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {stats.daily && stats.daily.length > 0 && (
                  <Box sx={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <AreaChart data={stats.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                        <XAxis dataKey="date" stroke="#8b949e" />
                        <YAxis stroke="#8b949e" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #30363d'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="processes"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.3}
                          name="Processes"
                        />
                        <Area
                          type="monotone"
                          dataKey="users"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.3}
                          name="Active Users"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </>
            )}
          </TabPanel>

          {/* Settings Tab */}
          <TabPanel value={activeTab} index={4}>
            <Typography variant="h6" sx={{ mb: 3 }}>Tenant Settings</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>General Information</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Created"
                      secondary={formatDate(tenant.createdAt, 'long')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Tenant ID"
                      secondary={tenant._id || tenant.id}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Domain"
                      secondary={tenant.domain || 'Not configured'}
                    />
                  </ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Limits & Usage</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Storage Limit"
                      secondary={formatBytes(tenant.limits?.maxStorage || 10737418240)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Max Processes/Month"
                      secondary={tenant.limits?.maxProcessesPerMonth === -1 ? 'Unlimited' : tenant.limits?.maxProcessesPerMonth}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Video Format Limits"
                      secondary={tenant.settings?.allowedVideoFormats?.join(', ') || 'All formats'}
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          </TabPanel>
        </StyledPaper>

        {/* Message Dialog */}
        <Dialog
          open={messageDialog}
          onClose={() => setMessageDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Send Message to Tenant</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Subject"
              value={message.subject}
              onChange={(e) => setMessage({ ...message, subject: e.target.value })}
              sx={{ mb: 2, mt: 2 }}
            />
            <TextField
              fullWidth
              label="Message"
              multiline
              rows={4}
              value={message.message}
              onChange={(e) => setMessage({ ...message, message: e.target.value })}
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={message.sendToAllUsers}
                  onChange={(e) => setMessage({ ...message, sendToAllUsers: e.target.checked })}
                />
              }
              label="Send to all users (not just admins)"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMessageDialog(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} variant="contained">
              Send Message
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </SuperAdminLayout>
  );
};

export default SuperAdminTenantDetails;