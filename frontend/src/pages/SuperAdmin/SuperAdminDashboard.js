import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Dashboard,
  People,
  TrendingUp,
  AttachMoney,
  Storage,
  Timeline,
  Download,
  Refresh,
  Business,
  VideoLibrary,
  Warning
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '../../services/superAdminService';
import SuperAdminLayout from '../../components/SuperAdmin/SuperAdminLayout';
import StatsCard from '../../components/SuperAdmin/StatsCard';
import GrowthChart from '../../components/SuperAdmin/GrowthChart';
import { formatCurrency, formatNumber } from '../../utils/formatters';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  height: '100%'
}));

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setError('');
      const [statsRes, activityRes, growthRes] = await Promise.all([
        superAdminService.getDashboardStats(),
        superAdminService.getRecentActivity(),
        superAdminService.getGrowthMetrics(30)
      ]);

      setStats(statsRes.stats);
      setActivity(activityRes.activity);
      setGrowthData(growthRes.growth);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleExport = async () => {
    try {
      await superAdminService.exportTenantData();
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export data');
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

  return (
    <SuperAdminLayout>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Super Admin Dashboard
          </Typography>
          <Box>
            <Button
              startIcon={<Download />}
              onClick={handleExport}
              sx={{ mr: 2 }}
            >
              Export Data
            </Button>
            <IconButton 
              onClick={handleRefresh}
              disabled={refreshing}
              sx={{ 
                backgroundColor: '#30363d',
                '&:hover': { backgroundColor: '#484f58' }
              }}
            >
              <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Tenants"
              value={stats?.tenants.total || 0}
              subtitle={`${stats?.tenants.active || 0} active`}
              icon={<Business />}
              color="#7c3aed"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Users"
              value={stats?.users.total || 0}
              subtitle={`+${stats?.users.newThisMonth || 0} this month`}
              icon={<People />}
              color="#3b82f6"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Total Processes"
              value={stats?.processes.total || 0}
              subtitle={`+${stats?.processes.newThisMonth || 0} this month`}
              icon={<VideoLibrary />}
              color="#10b981"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatsCard
              title="Monthly Revenue"
              value={formatCurrency(stats?.revenue.monthlyRecurring || 0)}
              subtitle={`${stats?.revenue.currency || 'EUR'}`}
              icon={<AttachMoney />}
              color="#f59e0b"
            />
          </Grid>
        </Grid>

        {/* Growth Chart */}
        {growthData && (
          <StyledPaper sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Platform Growth (Last 30 Days)
            </Typography>
            <GrowthChart data={growthData.dailyStats} />
          </StyledPaper>
        )}

        {/* Activity Tabs */}
        <StyledPaper>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            sx={{ borderBottom: '1px solid #30363d', mb: 3 }}
          >
            <Tab label="Recent Tenants" />
            <Tab label="Recent Users" />
            <Tab label="Recent Processes" />
          </Tabs>

          {/* Recent Tenants */}
          {activeTab === 0 && activity?.recentTenants && (
            <List>
              {activity.recentTenants.map((tenant) => (
                <ListItem
                  key={tenant.id}
                  sx={{
                    border: '1px solid #30363d',
                    borderRadius: 1,
                    mb: 1,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#1f2428' }
                  }}
                  onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#7c3aed' }}>
                      <Business />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={tenant.name}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption">
                          {tenant.domain || 'No domain'}
                        </Typography>
                        <Chip
                          label={tenant.plan}
                          size="small"
                          sx={{ height: 20 }}
                        />
                      </Box>
                    }
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </Typography>
                </ListItem>
              ))}
            </List>
          )}

          {/* Recent Users */}
          {activeTab === 1 && activity?.recentUsers && (
            <List>
              {activity.recentUsers.map((user) => (
                <ListItem
                  key={user.id}
                  sx={{
                    border: '1px solid #30363d',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#3b82f6' }}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption">
                          {user.email}
                        </Typography>
                        <Chip
                          label={user.role}
                          size="small"
                          sx={{ height: 20 }}
                        />
                      </Box>
                    }
                  />
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      {user.tenantName}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}

          {/* Recent Processes */}
          {activeTab === 2 && activity?.recentProcesses && (
            <List>
              {activity.recentProcesses.map((process) => (
                <ListItem
                  key={process.id}
                  sx={{
                    border: '1px solid #30363d',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: process.status === 'completed' ? '#10b981' : '#f59e0b' }}>
                      <VideoLibrary />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={process.title}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption">
                          {process.userEmail}
                        </Typography>
                        <Chip
                          label={process.status}
                          size="small"
                          color={process.status === 'completed' ? 'success' : 'warning'}
                          sx={{ height: 20 }}
                        />
                      </Box>
                    }
                  />
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      {process.tenantName}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {new Date(process.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </StyledPaper>

        {/* API Usage Warning */}
        {stats?.apiUsage?.estimatedCostThisMonth > 100 && (
          <Alert 
            severity="warning" 
            sx={{ mt: 3 }}
            icon={<Warning />}
          >
            High API usage detected: Estimated cost this month is {formatCurrency(stats.apiUsage.estimatedCostThisMonth)}
          </Alert>
        )}
      </Container>
    </SuperAdminLayout>
  );
};

export default SuperAdminDashboard;