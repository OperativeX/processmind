import React, { useState } from 'react';
import { Button, CircularProgress, Alert } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import api from '../../services/api';

const CustomerPortalButton = ({ 
  tenantId, 
  disabled = false, 
  children = "Manage Billing",
  variant = "outlined",
  color = "primary",
  ...props 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePortal = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/tenants/${tenantId}/billing/create-portal-session`, {
        returnUrl: window.location.href
      });

      if (response.data.success) {
        window.location.href = response.data.url;
      } else {
        setError(response.data.message || 'Failed to open billing portal');
      }
    } catch (err) {
      console.error('Portal error:', err);
      setError(err.response?.data?.message || 'Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        color={color}
        onClick={handlePortal}
        disabled={disabled || loading}
        startIcon={loading ? <CircularProgress size={20} /> : <SettingsIcon />}
        {...props}
      >
        {loading ? 'Opening...' : children}
      </Button>
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </>
  );
};

export default CustomerPortalButton;