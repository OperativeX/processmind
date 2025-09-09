import React, { useState } from 'react';
import { Button, CircularProgress, Alert } from '@mui/material';
import { ShoppingCart as ShoppingCartIcon } from '@mui/icons-material';
import { useStripe } from '@stripe/react-stripe-js';
import api from '../../services/api';

const CheckoutButton = ({ 
  tenantId, 
  priceId, 
  disabled = false, 
  children = "Upgrade Plan",
  variant = "contained",
  color = "primary",
  ...props 
}) => {
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckout = async () => {
    if (!stripe) {
      setError('Stripe is not configured. Please contact support.');
      return;
    }

    if (!priceId || priceId === 'price_your_basic_plan_price_id_here') {
      setError('Pricing not configured. Please contact support.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/tenants/${tenantId}/billing/create-checkout-session`, {
        priceId,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/billing/cancel`
      });

      if (response.data.success) {
        const { error } = await stripe.redirectToCheckout({
          sessionId: response.data.sessionId
        });

        if (error) {
          setError(error.message);
        }
      } else {
        setError(response.data.message || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.response?.data?.message || 'Failed to start checkout process');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        color={color}
        onClick={handleCheckout}
        disabled={disabled || loading || !stripe}
        startIcon={loading ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
        {...props}
      >
        {loading ? 'Processing...' : children}
      </Button>
      
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </>
  );
};

export default CheckoutButton;