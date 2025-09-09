import React from 'react';
import { Box } from '@mui/material';
import PublicHeader from '../components/Public/PublicHeader';
import PublicFooter from '../components/Public/PublicFooter';

const PublicLayout = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
        color: 'text.primary',
      }}
    >
      <PublicHeader />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
      <PublicFooter />
    </Box>
  );
};

export default PublicLayout;