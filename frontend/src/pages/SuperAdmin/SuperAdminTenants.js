import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Search,
  Edit,
  PowerSettingsNew,
  AttachMoney,
  Info,
  Download,
  Add,
  Business,
  People,
  VideoLibrary,
  TrendingUp
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../../components/SuperAdmin/SuperAdminLayout';
import { superAdminService } from '../../services/superAdminService';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';

const StyledPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  padding: theme.spacing(3)
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  borderBottom: '1px solid #30363d'
}));

const SuperAdminTenants = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [error, setError] = useState('');
  
  // Pricing dialog
  const [pricingDialog, setPricingDialog] = useState({
    open: false,
    tenant: null,
    enabled: false,
    pricePerUser: 10,
    freeUsers: 1,
    maxUsers: -1,
    notes: ''
  });

  useEffect(() => {
    loadTenants();
  }, [pagination.page, pagination.limit, search, statusFilter, sortBy, order]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await superAdminService.getTenants({
        page: pagination.page + 1,
        limit: pagination.limit,
        search,
        status: statusFilter,
        sortBy,
        order
      });

      setTenants(response.tenants);
      setPagination({
        ...pagination,
        total: response.pagination.total,
        pages: response.pagination.pages
      });
    } catch (err) {
      console.error('Load tenants error:', err);
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPagination({ ...pagination, page: newPage });
  };

  const handleChangeRowsPerPage = (event) => {
    setPagination({
      ...pagination,
      limit: parseInt(event.target.value, 10),
      page: 0
    });
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPagination({ ...pagination, page: 0 });
  };

  const handleOpenPricingDialog = async (tenant) => {
    setPricingDialog({
      open: true,
      tenant,
      plan: tenant.subscription?.plan || 'free',
      allowTeams: tenant.limits?.allowTeams || false,
      notes: tenant.billing?.notes || ''
    });
  };

  const handleSavePricing = async () => {
    try {
      await superAdminService.updateTenantPlan(pricingDialog.tenant._id, {
        plan: pricingDialog.plan,
        allowTeams: pricingDialog.allowTeams,
        notes: pricingDialog.notes
      });
      
      setPricingDialog({ ...pricingDialog, open: false });
      loadTenants(); // Reload to show updated data
    } catch (err) {
      console.error('Update plan error:', err);
      setError('Failed to update tenant plan');
    }
  };

  const handleToggleStatus = async (tenant) => {
    try {
      await superAdminService.updateTenantStatus(tenant._id, {
        isActive: !tenant.isActive,
        reason: `Status changed by super admin`
      });
      loadTenants();
    } catch (err) {
      console.error('Toggle status error:', err);
      setError('Failed to update tenant status');
    }
  };

  const handleExport = async () => {
    try {
      await superAdminService.exportTenantData();
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export data');
    }
  };

  if (loading && tenants.length === 0) {
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
            Tenant Management
          </Typography>
          <Button
            startIcon={<Download />}
            onClick={handleExport}
            variant="outlined"
          >
            Export CSV
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <StyledPaper sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search tenants..."
              value={search}
              onChange={handleSearch}
              sx={{ flex: 1, minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
            
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sort By"
              >
                <MenuItem value="createdAt">Created Date</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="userCount">Users</MenuItem>
                <MenuItem value="processCount">Processes</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </StyledPaper>

        {/* Tenants Table */}
        <StyledPaper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <StyledTableCell>Tenant</StyledTableCell>
                  <StyledTableCell>Status</StyledTableCell>
                  <StyledTableCell align="center">Users</StyledTableCell>
                  <StyledTableCell align="center">Processes</StyledTableCell>
                  <StyledTableCell align="right">Plan & Revenue</StyledTableCell>
                  <StyledTableCell align="center">Created</StyledTableCell>
                  <StyledTableCell align="center">Actions</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow
                    key={tenant._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/super-admin/tenants/${tenant._id}`)}
                  >
                    <StyledTableCell>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {tenant.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tenant.domain || 'No domain'}
                        </Typography>
                      </Box>
                    </StyledTableCell>
                    
                    <StyledTableCell>
                      <Chip
                        label={tenant.isActive ? 'Active' : 'Inactive'}
                        color={tenant.isActive ? 'success' : 'error'}
                        size="small"
                      />
                    </StyledTableCell>
                    
                    <StyledTableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <People fontSize="small" sx={{ opacity: 0.7 }} />
                        {tenant.userCount}
                      </Box>
                    </StyledTableCell>
                    
                    <StyledTableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <VideoLibrary fontSize="small" sx={{ opacity: 0.7 }} />
                        {tenant.processCount}
                      </Box>
                      {tenant.processesLastMonth > 0 && (
                        <Typography variant="caption" color="success.main">
                          +{tenant.processesLastMonth} this month
                        </Typography>
                      )}
                    </StyledTableCell>
                    
                    <StyledTableCell align="right">
                      <Chip
                        label={tenant.subscription?.plan?.toUpperCase() || 'FREE'}
                        color={tenant.subscription?.plan === 'pro' ? 'success' : 'default'}
                        size="small"
                        sx={{ mb: 0.5 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(tenant.monthlyRevenue)}
                      </Typography>
                    </StyledTableCell>
                    
                    <StyledTableCell align="center">
                      {formatDate(tenant.createdAt)}
                    </StyledTableCell>
                    
                    <StyledTableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit Pricing">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenPricingDialog(tenant)}
                          sx={{ mr: 1 }}
                        >
                          <AttachMoney />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title={tenant.isActive ? 'Deactivate' : 'Activate'}>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(tenant)}
                          color={tenant.isActive ? 'error' : 'success'}
                        >
                          <PowerSettingsNew />
                        </IconButton>
                      </Tooltip>
                    </StyledTableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            component="div"
            count={pagination.total}
            page={pagination.page}
            onPageChange={handleChangePage}
            rowsPerPage={pagination.limit}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{ borderTop: '1px solid #30363d' }}
          />
        </StyledPaper>

        {/* Pricing Dialog */}
        <Dialog
          open={pricingDialog.open}
          onClose={() => setPricingDialog({ ...pricingDialog, open: false })}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: '#1a1a1a',
              border: '1px solid #30363d'
            }
          }}
        >
          <DialogTitle>
            Edit Plan - {pricingDialog.tenant?.name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Plan</InputLabel>
                <Select
                  value={pricingDialog.plan}
                  onChange={(e) => setPricingDialog({
                    ...pricingDialog,
                    plan: e.target.value,
                    allowTeams: e.target.value === 'pro' // Auto-enable teams for Pro
                  })}
                  label="Plan"
                >
                  <MenuItem value="free">Free Plan</MenuItem>
                  <MenuItem value="pro">Pro Plan</MenuItem>
                </Select>
              </FormControl>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={pricingDialog.allowTeams}
                    onChange={(e) => setPricingDialog({
                      ...pricingDialog,
                      allowTeams: e.target.checked
                    })}
                    disabled={pricingDialog.plan === 'free'} // Teams only available for Pro
                  />
                }
                label="Allow Team Features"
                sx={{ mb: 3 }}
              />
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Plan Details:
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                {pricingDialog.plan === 'free' ? (
                  'Free Plan: 1 user, 10 uploads/month, 20GB storage'
                ) : (
                  'Pro Plan: Unlimited users, uploads & storage - €10/user/month'
                )}
              </Alert>
              
              <TextField
                fullWidth
                label="Internal Notes"
                multiline
                rows={3}
                value={pricingDialog.notes}
                onChange={(e) => setPricingDialog({
                  ...pricingDialog,
                  notes: e.target.value
                })}
                helperText="e.g., Beta Tester, Partner, Special Deal"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setPricingDialog({ ...pricingDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePricing}
              variant="contained"
              color="primary"
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </SuperAdminLayout>
  );
};

export default SuperAdminTenants;