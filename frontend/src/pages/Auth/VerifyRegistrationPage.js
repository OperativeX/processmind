import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { useAuth } from '../../contexts/AuthContext';
import ProcessLinkLogo from '../../components/Common/ProcessLinkLogo';

const schema = yup.object().shape({
  code: yup
    .string()
    .matches(/^\d{6}$/, 'Code must be exactly 6 digits')
    .required('Verification code is required'),
});

const VerifyRegistrationPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyRegistration } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  // Get email from navigation state
  const email = location.state?.email;
  
  useEffect(() => {
    // Redirect if no email provided
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);
  
  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
  });

  // Auto-advance when 6 digits entered
  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 6) {
      setValue('code', value);
      if (value.length === 6) {
        // Auto-submit when 6 digits entered
        handleSubmit(onSubmit)();
      }
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setError('');
    setResendSuccess(false);

    try {
      const result = await verifyRegistration(email, data.code);
      
      if (result.success) {
        // Registration completed, user is now logged in
        navigate('/dashboard', { replace: true });
      } else {
        setError(result.error || 'Invalid verification code');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setResendSuccess(false);
    setCountdown(60); // 60 second cooldown

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1'}/auth/resend-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResendSuccess(true);
      } else {
        setError(data.message || 'Failed to resend code');
      }
    } catch (error) {
      setError('Failed to resend verification code');
    }
  };

  if (!email) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(124, 58, 237, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 40% 80%, rgba(124, 58, 237, 0.03) 0%, transparent 50%)
        `,
        p: 3,
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          boxShadow: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <ProcessLinkLogo size={64} sx={{ mb: 2 }} />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              ProcessLink
            </Typography>
            <CheckCircleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Verify your email
            </Typography>
            <Typography variant="body2" color="text.secondary">
              We've sent a 6-digit code to
              <br />
              <strong>{email}</strong>
            </Typography>
          </Box>

          {/* Success Alert */}
          {resendSuccess && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Verification code resent successfully!
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              {...register('code')}
              fullWidth
              label="Enter 6-digit code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              error={!!errors.code}
              helperText={errors.code?.message || 'Enter the code sent to your email'}
              sx={{ mb: 3 }}
              onChange={handleCodeChange}
              inputProps={{
                maxLength: 6,
                style: {
                  fontSize: '24px',
                  letterSpacing: '8px',
                  textAlign: 'center',
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ mb: 2, py: 1.5 }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Verify Email'
              )}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={handleResendCode}
              disabled={countdown > 0}
              sx={{ mb: 3 }}
            >
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link
                component={RouterLink}
                to="/register"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <ArrowBackIcon sx={{ mr: 1, fontSize: 18 }} />
                Back to Registration
              </Link>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Footer */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          © 2024 ProcessLink. AI-powered video processing.
        </Typography>
      </Box>
    </Box>
  );
};

export default VerifyRegistrationPage;