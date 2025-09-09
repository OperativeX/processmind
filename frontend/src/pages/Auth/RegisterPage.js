import React, { useState, useCallback, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  IconButton,
  Divider,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Language as LanguageIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { useAuth } from '../../contexts/AuthContext';
import ProcessLinkLogo from '../../components/Common/ProcessLinkLogo';
import { authAPI } from '../../services/api';
import { debounce } from 'lodash';

const schema = yup.object().shape({
  firstName: yup
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .required('First name is required'),
  lastName: yup
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters')
    .required('Last name is required'),
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  tenantName: yup
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name cannot exceed 100 characters')
    .required('Organization name is required'),
  subdomain: yup
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(30, 'Subdomain cannot exceed 30 characters')
    .matches(
      /^[a-z0-9-]+$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens'
    )
    .required('Subdomain is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [subdomainStatus, setSubdomainStatus] = useState({
    checking: false,
    available: null,
    message: ''
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur',
  });

  const password = watch('password', '');
  const subdomain = watch('subdomain', '');

  // Check subdomain availability
  const checkSubdomainAvailability = useCallback(
    debounce(async (subdomain) => {
      if (!subdomain || subdomain.length < 3) {
        setSubdomainStatus({ checking: false, available: null, message: '' });
        return;
      }

      // Validate format
      if (!/^[a-z0-9-]+$/.test(subdomain)) {
        setSubdomainStatus({
          checking: false,
          available: false,
          message: 'Only lowercase letters, numbers and hyphens allowed'
        });
        return;
      }

      setSubdomainStatus({ checking: true, available: null, message: '' });

      try {
        const response = await authAPI.checkSubdomain(subdomain);
        if (response.data.success) {
          setSubdomainStatus({
            checking: false,
            available: response.data.data.available,
            message: response.data.data.available 
              ? `${subdomain}.processlink.de is available!`
              : 'This subdomain is already taken'
          });
        }
      } catch (error) {
        setSubdomainStatus({
          checking: false,
          available: false,
          message: 'Error checking availability'
        });
      }
    }, 500),
    []
  );

  // Effect to check subdomain when it changes
  useEffect(() => {
    if (subdomain) {
      checkSubdomainAvailability(subdomain);
    }
  }, [subdomain, checkSubdomainAvailability]);

  // Password strength calculation
  const getPasswordStrength = (password) => {
    let score = 0;
    if (!password) return { score: 0, label: '', color: 'inherit' };

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[@$!%*?&]/.test(password)) score += 1;

    const strength = {
      0: { label: '', color: 'inherit' },
      1: { label: 'Very Weak', color: 'error.main' },
      2: { label: 'Weak', color: 'error.main' },
      3: { label: 'Fair', color: 'warning.main' },
      4: { label: 'Good', color: 'info.main' },
      5: { label: 'Strong', color: 'success.main' },
      6: { label: 'Very Strong', color: 'success.main' },
    };

    return { score: (score / 6) * 100, ...strength[score] };
  };

  const passwordStrength = getPasswordStrength(password);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setRegisterError('');

    try {
      const { confirmPassword, ...userData } = data;
      const result = await registerUser(userData);
      
      if (result.success) {
        // Redirect to verification page with email
        navigate('/verify-registration', { 
          state: { email: userData.email },
          replace: true 
        });
      } else {
        setRegisterError(result.error || 'Registration failed. Please try again.');
      }
    } catch (error) {
      setRegisterError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        py: 6,
      }}
    >
      <Card
        sx={{
          maxWidth: 500,
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
            <Typography variant="h6" sx={{ mb: 1 }}>
              Create your account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start processing videos with AI-powered analysis
            </Typography>
          </Box>

          {/* Error Alert */}
          {registerError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {registerError}
            </Alert>
          )}

          {/* Registration Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            {/* Name Fields */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                {...register('firstName')}
                fullWidth
                label="First Name"
                autoComplete="given-name"
                autoFocus
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                {...register('lastName')}
                fullWidth
                label="Last Name"
                autoComplete="family-name"
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
              />
            </Box>

            <TextField
              {...register('email')}
              fullWidth
              label="Email address"
              type="email"
              autoComplete="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              {...register('tenantName')}
              fullWidth
              label="Organization Name"
              autoComplete="organization"
              error={!!errors.tenantName}
              helperText={errors.tenantName?.message}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              {...register('subdomain')}
              fullWidth
              label="Subdomain"
              placeholder="your-company"
              error={!!errors.subdomain || (subdomainStatus.available === false)}
              helperText={
                errors.subdomain?.message || 
                subdomainStatus.message ||
                'This will be your unique URL: your-company.processlink.de'
              }
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LanguageIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {subdomainStatus.checking ? (
                      <CircularProgress size={20} />
                    ) : subdomainStatus.available === true ? (
                      <CheckIcon color="success" />
                    ) : subdomainStatus.available === false ? (
                      <CloseIcon color="error" />
                    ) : null}
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              {...register('password')}
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={{ mb: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Password Strength Indicator */}
            {password && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Password Strength
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ color: passwordStrength.color, fontWeight: 500 }}
                  >
                    {passwordStrength.label}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={passwordStrength.score}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: passwordStrength.color,
                    },
                  }}
                />
              </Box>
            )}

            <TextField
              {...register('confirmPassword')}
              fullWidth
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      aria-label="toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
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
              sx={{ mb: 2, py: 1.5 }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Create Account'
              )}
            </Button>
          </Box>

          {/* Terms */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            By creating an account, you agree to our{' '}
            <Link href="#" sx={{ textDecoration: 'none' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="#" sx={{ textDecoration: 'none' }}>
              Privacy Policy
            </Link>
          </Typography>

          <Divider sx={{ my: 3 }} />

          {/* Sign In Link */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link
                component={RouterLink}
                to="/login"
                sx={{
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: 'primary.main',
                }}
              >
                Sign in
              </Link>
            </Typography>
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

export default RegisterPage;