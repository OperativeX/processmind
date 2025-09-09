import React from 'react';
import { Box } from '@mui/material';
import Layout from '../../components/Layout/Layout';
import FavoriteListManager from '../../components/FavoriteList/FavoriteListManager';

const FavoriteListsPage = () => {
  return (
    <Layout>
      <Box sx={{ 
        minHeight: '100vh',
        backgroundColor: '#0d1117',
        color: '#f0f6fc'
      }}>
        <FavoriteListManager />
      </Box>
    </Layout>
  );
};

export default FavoriteListsPage;