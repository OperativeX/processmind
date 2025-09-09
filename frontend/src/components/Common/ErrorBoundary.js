import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Collapse,
  IconButton,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';
import ProcessLinkLogo from './ProcessLinkLogo';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and any error reporting service
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, LogRocket, etc.
      // logErrorToService(error, errorInfo);
    }
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false 
    });
  };

  toggleDetails = () => {
    this.setState(prevState => ({ 
      showDetails: !prevState.showDetails 
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background.default',
            p: 3,
          }}
        >
          <Box
            sx={{
              maxWidth: 600,
              width: '100%',
              textAlign: 'center',
            }}
          >
            {/* Logo and Main Error */}
            <Box sx={{ mb: 4 }}>
              <ProcessLinkLogo size={64} sx={{ mb: 2 }} />
              <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                Oops! Something went wrong
              </Typography>
              <Typography variant="body1" color="text.secondary">
                We're sorry, but something unexpected happened. 
                Please try refreshing the page or contact support if the problem persists.
              </Typography>
            </Box>

            {/* Error Alert */}
            <Alert 
              severity="error" 
              icon={<ErrorIcon />}
              sx={{ mb: 3, textAlign: 'left' }}
            >
              <AlertTitle>Application Error</AlertTitle>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Alert>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRefresh}
                size="large"
              >
                Refresh Page
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReset}
                size="large"
              >
                Try Again
              </Button>
            </Box>

            {/* Error Details (Collapsible) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Card sx={{ textAlign: 'left' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BugIcon sx={{ mr: 1, color: 'error.main' }} />
                    <Typography variant="h6">
                      Error Details
                    </Typography>
                    <IconButton 
                      onClick={this.toggleDetails}
                      sx={{ ml: 'auto' }}
                      size="small"
                    >
                      {this.state.showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  
                  <Collapse in={this.state.showDetails}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="error" gutterBottom>
                        Error Message:
                      </Typography>
                      <Typography 
                        variant="body2" 
                        component="pre"
                        sx={{ 
                          backgroundColor: 'background.paper',
                          p: 1.5,
                          borderRadius: 1,
                          overflow: 'auto',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        {this.state.error.toString()}
                      </Typography>
                    </Box>

                    {this.state.errorInfo?.componentStack && (
                      <Box>
                        <Typography variant="subtitle2" color="error" gutterBottom>
                          Component Stack:
                        </Typography>
                        <Typography 
                          variant="body2" 
                          component="pre"
                          sx={{ 
                            backgroundColor: 'background.paper',
                            p: 1.5,
                            borderRadius: 1,
                            overflow: 'auto',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            border: '1px solid',
                            borderColor: 'divider',
                            maxHeight: 200,
                          }}
                        >
                          {this.state.errorInfo.componentStack}
                        </Typography>
                      </Box>
                    )}
                  </Collapse>
                </CardContent>
              </Card>
            )}

            {/* Contact Support */}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
              If this problem continues, please{' '}
              <Button 
                variant="text" 
                size="small"
                sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
                onClick={() => {
                  window.open('mailto:support@processlink.com?subject=Application Error', '_blank');
                }}
              >
                contact support
              </Button>
              {' '}with details about what you were doing when this error occurred.
            </Typography>
          </Box>

          {/* Background decoration */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                radial-gradient(circle at 20% 50%, rgba(220, 38, 38, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(239, 68, 68, 0.03) 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, rgba(220, 38, 38, 0.02) 0%, transparent 50%)
              `,
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />
        </Box>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for hooks usage
export const ErrorBoundaryWrapper = ({ children, fallback, onError }) => {
  return (
    <ErrorBoundaryClass fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundaryClass>
  );
};

// Class component for Error Boundary (hooks don't work with error boundaries)
class ErrorBoundaryClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }

      return (
        <Alert severity="error" sx={{ m: 2 }}>
          <AlertTitle>Something went wrong</AlertTitle>
          {this.state.error?.message || 'An unexpected error occurred'}
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;