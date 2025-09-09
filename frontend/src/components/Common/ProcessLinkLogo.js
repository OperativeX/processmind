import React from 'react';
import { Box, SvgIcon } from '@mui/material';

const ProcessLinkLogo = ({ size = 32, ...props }) => {
  return (
    <SvgIcon
      viewBox="0 0 32 32"
      sx={{
        width: size,
        height: size,
        ...props.sx,
      }}
      {...props}
    >
      {/* Outer circle with gradient */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="innerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      
      {/* Main circle */}
      <circle 
        cx="16" 
        cy="16" 
        r="14" 
        fill="url(#logoGradient)"
        stroke="rgba(124, 58, 237, 0.2)"
        strokeWidth="1"
      />
      
      {/* Inner geometric pattern representing process flow */}
      <g fill="white" fillOpacity="0.9">
        {/* Central node */}
        <circle cx="16" cy="16" r="3" />
        
        {/* Connected nodes */}
        <circle cx="8" cy="12" r="2" />
        <circle cx="24" cy="12" r="2" />
        <circle cx="8" cy="20" r="2" />
        <circle cx="24" cy="20" r="2" />
        
        {/* Connection lines */}
        <line x1="16" y1="16" x2="8" y2="12" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
        <line x1="16" y1="16" x2="24" y2="12" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
        <line x1="16" y1="16" x2="8" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
        <line x1="16" y1="16" x2="24" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
        
        {/* Process flow arrows */}
        <path d="M10 12 L14 14 L10 16 Z" fill="url(#innerGradient)" fillOpacity="0.8" />
        <path d="M22 12 L18 14 L22 16 Z" fill="url(#innerGradient)" fillOpacity="0.8" />
      </g>
      
      {/* Subtle outer glow effect */}
      <circle 
        cx="16" 
        cy="16" 
        r="15" 
        fill="none"
        stroke="url(#logoGradient)"
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />
    </SvgIcon>
  );
};

// Alternative simplified version for small sizes
export const ProcessLinkLogoSimple = ({ size = 24, ...props }) => {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '60%',
          height: '60%',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.9)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: '30%',
          height: '30%',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
          zIndex: 1,
        },
        ...props.sx,
      }}
      {...props}
    />
  );
};

export default ProcessLinkLogo;