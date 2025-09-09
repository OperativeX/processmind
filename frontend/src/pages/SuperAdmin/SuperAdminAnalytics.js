import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import {
  Timeline,
  TrendingUp,
  TrendingDown,
  Download,
  DateRange,
  People,
  VideoLibrary,
  AttachMoney,
  Speed
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import SuperAdminLayout from '../../components/SuperAdmin/SuperAdminLayout';
import { superAdminService } from '../../services/superAdminService';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  height: '100%'
}));

const MetricCard = ({ title, value, change, icon, color }) => (
  <Card sx={{ backgroundColor: '#1a1a1a', border: '1px solid #30363d', height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Box sx={{ color: color || '#7c3aed' }}>
          {icon}
        </Box>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        {value}
      </Typography>
      {change !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {change >= 0 ? (
            <TrendingUp sx={{ color: '#10b981', fontSize: 20 }} />
          ) : (
            <TrendingDown sx={{ color: '#ef4444', fontSize: 20 }} />
          )}
          <Typography
            variant="caption"
            sx={{ color: change >= 0 ? '#10b981' : '#ef4444' }}
          >
            {formatPercentage(Math.abs(change))}
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

const SuperAdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(30);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  const [analyticsData, setAnalyticsData] = useState(null);
  const [tenantMetrics, setTenantMetrics] = useState([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [period, dateRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load growth metrics and tenant statistics
      const [growthRes, tenantsRes] = await Promise.all([
        superAdminService.getGrowthMetrics(period),
        superAdminService.getTenants({ limit: 100 })
      ]);

      setAnalyticsData(growthRes.growth);

      // Calculate tenant metrics
      const metrics = tenantsRes.tenants.map(tenant => ({
        name: tenant.name,
        users: tenant.userCount,
        processes: tenant.processCount,
        revenue: tenant.monthlyRevenue,
        growth: tenant.processesLastMonth
      }));
      setTenantMetrics(metrics);

    } catch (err) {
      console.error('Analytics load error:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportAnalytics = async () => {
    try {
      await superAdminService.exportAnalytics(
        dateRange.start.toISOString(),
        dateRange.end.toISOString()
      );
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export analytics');
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

  const chartColors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Prepare pie chart data
  const revenueByPlan = tenantMetrics.reduce((acc, tenant) => {
    const plan = tenant.revenue > 100 ? 'Premium' : tenant.revenue > 0 ? 'Basic' : 'Free';
    if (!acc[plan]) acc[plan] = 0;
    acc[plan] += tenant.revenue;
    return acc;
  }, {});

  const pieData = Object.entries(revenueByPlan).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <SuperAdminLayout>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Analytics & Insights
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Period</InputLabel>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                label="Period"
              >
                <MenuItem value={7}>7 Days</MenuItem>
                <MenuItem value={30}>30 Days</MenuItem>
                <MenuItem value={90}>90 Days</MenuItem>
                <MenuItem value={365}>1 Year</MenuItem>
              </Select>
            </FormControl>
            <Button
              startIcon={<Download />}
              onClick={handleExportAnalytics}
              variant="outlined"
            >
              Export Report
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Key Metrics */}
        {analyticsData && (
          <>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="Total Revenue"
                  value={formatCurrency(analyticsData.currentPeriod?.revenue || 0)}
                  change={analyticsData.growthRates?.revenue}
                  icon={<AttachMoney />}
                  color="#f59e0b"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="New Users"
                  value={formatNumber(analyticsData.currentPeriod?.users || 0)}
                  change={analyticsData.growthRates?.users}
                  icon={<People />}
                  color="#3b82f6"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="New Processes"
                  value={formatNumber(analyticsData.currentPeriod?.processes || 0)}
                  change={analyticsData.growthRates?.processes}
                  icon={<VideoLibrary />}
                  color="#10b981"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <MetricCard
                  title="Avg. Processing Time"
                  value="2.4 min"
                  change={-15}
                  icon={<Speed />}
                  color="#ef4444"
                />
              </Grid>
            </Grid>

            {/* Charts */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {/* Growth Trend */}
              <Grid item xs={12} lg={8}>
                <StyledPaper>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Growth Trend
                  </Typography>
                  <Box sx={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                      <AreaChart data={analyticsData.dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#8b949e"
                          style={{ fontSize: 12 }}
                        />
                        <YAxis 
                          stroke="#8b949e"
                          style={{ fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #30363d',
                            borderRadius: 4
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#f59e0b"
                          fill="#f59e0b"
                          fillOpacity={0.3}
                          name="Revenue (€)"
                        />
                        <Area
                          type="monotone"
                          dataKey="users"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.3}
                          name="New Users"
                        />
                        <Area
                          type="monotone"
                          dataKey="processes"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.3}
                          name="Processes"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </StyledPaper>
              </Grid>

              {/* Revenue Distribution */}
              <Grid item xs={12} lg={4}>
                <StyledPaper>
                  <Typography variant="h6" sx={{ mb: 3 }}>
                    Revenue by Plan
                  </Typography>
                  <Box sx={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #30363d'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </StyledPaper>
              </Grid>
            </Grid>
          </>
        )}

        {/* Top Tenants Table */}
        <StyledPaper>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Top Performing Tenants
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tenant Name</TableCell>
                  <TableCell align="right">Users</TableCell>
                  <TableCell align="right">Processes</TableCell>
                  <TableCell align="right">Monthly Revenue</TableCell>
                  <TableCell align="right">Growth</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenantMetrics
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 10)
                  .map((tenant, index) => (
                    <TableRow key={index}>
                      <TableCell>{tenant.name}</TableCell>
                      <TableCell align="right">{tenant.users}</TableCell>
                      <TableCell align="right">{tenant.processes}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(tenant.revenue)}
                      </TableCell>
                      <TableCell align="right">
                        {tenant.growth > 0 && (
                          <Chip
                            label={`+${tenant.growth}`}
                            size="small"
                            color="success"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </StyledPaper>
      </Container>
    </SuperAdminLayout>
  );
};

export default SuperAdminAnalytics;