import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme, color }) => ({
  backgroundColor: '#1a1a1a',
  border: '1px solid #30363d',
  height: '100%',
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    borderColor: color || '#7c3aed',
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 20px rgba(124, 58, 237, 0.2)`
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: color || '#7c3aed'
  }
}));

const StatsCard = ({ title, value, subtitle, icon, color }) => {
  return (
    <StyledCard color={color}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Box sx={{ color: color || '#7c3aed', opacity: 0.8 }}>
            {icon}
          </Box>
        </Box>
        
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          {value}
        </Typography>
        
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </StyledCard>
  );
};

export default StatsCard;