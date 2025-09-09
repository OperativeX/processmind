import React from 'react';
import { Box, CircularProgress, Typography, keyframes } from '@mui/material';
import ProcessLinkLogo from './ProcessLinkLogo';

// Pulse animation for logo
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

// Fade in animation
const fadeInAnimation = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const LoadingScreen = ({ 
  message = 'Loading...', 
  showLogo = true, 
  minimal = false,
  fullScreen = true 
}) => {
  if (minimal) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <CircularProgress size={24} thickness={4} />
        {message && (
          <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: fullScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        zIndex: fullScreen ? 9999 : 1,
        minHeight: fullScreen ? '100vh' : '200px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: `${fadeInAnimation} 0.6s ease-out`,
        }}
      >
        {showLogo && (
          <Box
            sx={{
              mb: 3,
              animation: `${pulseAnimation} 2s ease-in-out infinite`,
            }}
          >
            <ProcessLinkLogo size={64} />
          </Box>
        )}

        <Box sx={{ position: 'relative', mb: 2 }}>
          <CircularProgress
            size={50}
            thickness={3}
            sx={{
              color: 'primary.main',
            }}
          />
        </Box>

        <Typography
          variant="h6"
          sx={{
            color: 'text.primary',
            fontWeight: 500,
            textAlign: 'center',
            animation: `${fadeInAnimation} 0.6s ease-out 0.2s both`,
          }}
        >
          {message}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            mt: 1,
            animation: `${fadeInAnimation} 0.6s ease-out 0.4s both`,
          }}
        >
          Please wait while we process your request
        </Typography>
      </Box>

      {/* Background pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(124, 58, 237, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(124, 58, 237, 0.02) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
        }}
      />
    </Box>
  );
};

// Loading spinner component for inline use
export const LoadingSpinner = ({ size = 24, color = 'primary', ...props }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...props.sx,
      }}
      {...props}
    >
      <CircularProgress size={size} color={color} thickness={4} />
    </Box>
  );
};

// Loading dots animation
export const LoadingDots = ({ color = 'text.secondary', ...props }) => {
  const dotAnimation = keyframes`
    0%, 80%, 100% {
      transform: scale(0);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  `;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        ...props.sx,
      }}
      {...props}
    >
      {[0, 1, 2].map((index) => (
        <Box
          key={index}
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: color,
            animation: `${dotAnimation} 1.4s ease-in-out infinite both`,
            animationDelay: `${index * 0.16}s`,
          }}
        />
      ))}
    </Box>
  );
};

// Skeleton loader for content
export const SkeletonLoader = ({ 
  width = '100%', 
  height = 20, 
  variant = 'rectangular',
  animation = 'pulse',
  ...props 
}) => {
  const skeletonAnimation = keyframes`
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  `;

  const waveAnimation = keyframes`
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(100%);
    }
    100% {
      transform: translateX(100%);
    }
  `;

  return (
    <Box
      sx={{
        width,
        height,
        backgroundColor: 'action.hover',
        borderRadius: variant === 'circular' ? '50%' : 1,
        animation: animation === 'pulse' 
          ? `${skeletonAnimation} 1.5s ease-in-out infinite`
          : undefined,
        position: 'relative',
        overflow: 'hidden',
        ...(animation === 'wave' && {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            transform: 'translateX(-100%)',
            background: `linear-gradient(90deg, 
              transparent, 
              rgba(255, 255, 255, 0.1), 
              transparent
            )`,
            animation: `${waveAnimation} 2s infinite`,
          },
        }),
        ...props.sx,
      }}
      {...props}
    />
  );
};

export default LoadingScreen;