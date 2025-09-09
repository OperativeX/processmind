import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Tooltip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  OpenInNew as OpenIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { billingAPI } from '../../services/api';

const InvoiceHistory = ({ tenantId }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, [tenantId]);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await billingAPI.getInvoices(tenantId);
      setInvoices(response.data.data.invoices || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setError('Failed to load invoice history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      paid: { label: 'Paid', color: 'success' },
      open: { label: 'Open', color: 'warning' },
      draft: { label: 'Draft', color: 'default' },
      void: { label: 'Void', color: 'error' },
      uncollectible: { label: 'Uncollectible', color: 'error' }
    };

    const config = statusConfig[status] || { label: status, color: 'default' };

    return (
      <Chip
        label={config.label}
        color={config.color}
        size="small"
      />
    );
  };

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={loadInvoices}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ReceiptIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Invoice History
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={loadInvoices} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {invoices.length === 0 ? (
          <Alert severity="info">
            No invoices found. Invoices will appear here after your first billing cycle.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {formatDate(invoice.created)}
                    </TableCell>
                    <TableCell>
                      {invoice.number || 'Draft'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(invoice.status)}
                    </TableCell>
                    <TableCell align="right">
                      {invoice.hostedUrl && (
                        <Tooltip title="View Invoice">
                          <IconButton
                            size="small"
                            href={invoice.hostedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {invoice.pdfUrl && (
                        <Tooltip title="Download PDF">
                          <IconButton
                            size="small"
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default InvoiceHistory;