import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Shield,
  Lock
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { superAdminService } from '../../services/superAdminService';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  backgroundColor: '#1a1a1a',
  border: '1px solid #ff4444',
  boxShadow: '0 0 20px rgba(255, 68, 68, 0.3)',
  maxWidth: 400,
  width: '100%'
}));

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await superAdminService.login(
        formData.email,
        formData.password
      );

      if (response.success) {
        // Store token
        localStorage.setItem('superAdminToken', response.token);
        
        // Redirect to super admin dashboard
        navigate('/super-admin/dashboard');
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      console.error('Super admin login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d1117',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 35px,
              rgba(255, 68, 68, 0.05) 35px,
              rgba(255, 68, 68, 0.05) 70px
            )
          `,
          pointerEvents: 'none'
        }}
      />

      <StyledPaper elevation={0}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Shield 
            sx={{ 
              fontSize: 60, 
              color: '#ff4444',
              mb: 2
            }} 
          />
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Super Admin Access
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Authorized personnel only
          </Typography>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              backgroundColor: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid #ff4444'
            }}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            name="email"
            type="email"
            label="Admin Email"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="off"
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: '#ff4444' }} />
                </InputAdornment>
              )
            }}
          />

          <TextField
            fullWidth
            name="password"
            type={showPassword ? 'text' : 'password'}
            label="Admin Password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="off"
            sx={{ mb: 4 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: '#ff4444' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              backgroundColor: '#ff4444',
              '&:hover': {
                backgroundColor: '#cc0000'
              },
              py: 1.5,
              fontWeight: 600
            }}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: 'white' }} />
            ) : (
              'Access Super Admin Panel'
            )}
          </Button>
        </form>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            This area is restricted to system administrators only.
            <br />
            All access attempts are logged and monitored.
          </Typography>
        </Box>
      </StyledPaper>
    </Box>
  );
};

export default SuperAdminLogin;