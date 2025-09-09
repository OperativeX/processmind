import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Email as EmailIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { authAPI } from '../../services/api';
import ProcessLinkLogo from '../../components/Common/ProcessLinkLogo';

const schema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
});

const ForgotPasswordPage = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur',
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setError('');

    try {
      await authAPI.forgotPassword(data.email);
      setSuccess(true);
    } catch (error) {
      setError(
        error.response?.data?.message || 
        'Failed to send reset email. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    const email = getValues('email');
    if (email) {
      setIsSubmitting(true);
      try {
        await authAPI.forgotPassword(email);
        setError('');
      } catch (error) {
        setError('Failed to resend email. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

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
            {success ? (
              <>
                <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Check your email
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  We've sent a password reset link to your email address
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Forgot your password?
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter your email address and we'll send you a link to reset your password
                </Typography>
              </>
            )}
          </Box>

          {success ? (
            /* Success State */
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                A password reset link has been sent to{' '}
                <strong>{getValues('email')}</strong>
              </Alert>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                Didn't receive the email? Check your spam folder or try again.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleResend}
                  disabled={isSubmitting}
                  fullWidth
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} />
                  ) : (
                    'Resend Email'
                  )}
                </Button>

                <Button
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                  startIcon={<ArrowBackIcon />}
                  fullWidth
                >
                  Back to Sign In
                </Button>
              </Box>
            </Box>
          ) : (
            /* Form State */
            <>
              {/* Error Alert */}
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {/* Form */}
              <Box component="form" onSubmit={handleSubmit(onSubmit)}>
                <TextField
                  {...register('email')}
                  fullWidth
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={isSubmitting}
                  sx={{ mb: 3, py: 1.5 }}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>

                <Box sx={{ textAlign: 'center' }}>
                  <Link
                    component={RouterLink}
                    to="/login"
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
                    Back to Sign In
                  </Link>
                </Box>
              </Box>
            </>
          )}
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

export default ForgotPasswordPage;