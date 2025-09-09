import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Upload as UploadIcon,
  VideoLibrary as ProcessIcon,
  Person as MyProcessIcon,
  Share as GraphIcon,
  Favorite as FavoriteIcon,
  Settings as SettingsIcon,
  Tag as TagIcon,
  Star as BillingIcon,
} from '@mui/icons-material';

import { useQuery } from '@tanstack/react-query';
import { processAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ onItemClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant, user } = useAuth();

  // Fetch tags for sidebar
  const { data: tagsData } = useQuery({
    queryKey: ['tags', tenant?.id],
    queryFn: () => processAPI.getTags(tenant?.id),
    enabled: !!tenant?.id,
    select: (data) => data.data.tags,
  });

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
    },
    {
      text: 'Upload Video',
      icon: <UploadIcon />,
      path: '/upload',
    },
    {
      text: 'All Processes',
      icon: <ProcessIcon />,
      path: '/processes',
    },
    {
      text: 'Meine Prozesse',
      icon: <MyProcessIcon />,
      path: '/my-processes',
    },
    {
      text: 'Favorites',
      icon: <FavoriteIcon />,
      path: '/favorites',
    },
    {
      text: 'Graph View',
      icon: <GraphIcon />,
      path: '/graph',
    },
  ];

  const handleItemClick = (path) => {
    navigate(path);
    if (onItemClick) {
      onItemClick();
    }
  };

  const isActiveRoute = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar />
      
      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        {/* Main Navigation */}
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => handleItemClick(item.path)}
                selected={isActiveRoute(item.path)}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(124, 58, 237, 0.12)',
                    '&:hover': {
                      backgroundColor: 'rgba(124, 58, 237, 0.16)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '& .MuiListItemText-primary': {
                      color: 'primary.main',
                      fontWeight: 600,
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActiveRoute(item.path) ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      fontSize: '0.875rem',
                      fontWeight: isActiveRoute(item.path) ? 600 : 400,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ mx: 2, my: 2 }} />

        {/* Tags Section */}
        <Box sx={{ px: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TagIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
            <Typography
              variant="subtitle2"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Popular Tags
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {tagsData?.slice(0, 10).map((tag) => (
              <Chip
                key={tag.tag}
                label={tag.tag}
                size="small"
                variant="outlined"
                onClick={() => {
                  navigate(`/processes?tags=${encodeURIComponent(tag.tag)}`);
                  if (onItemClick) {
                    onItemClick();
                  }
                }}
                sx={{
                  fontSize: '0.75rem',
                  height: 24,
                  cursor: 'pointer',
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                  },
                  '& .MuiChip-label': {
                    px: 1,
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        <Divider sx={{ mx: 2, my: 2 }} />

        {/* Billing - Show for all users */}
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => handleItemClick('/billing')}
              selected={isActiveRoute('/billing')}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(124, 58, 237, 0.12)',
                  '&:hover': {
                    backgroundColor: 'rgba(124, 58, 237, 0.16)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(124, 58, 237, 0.08)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActiveRoute('/billing') ? 'primary.main' : user?.accountType === 'free' ? 'success.main' : 'text.primary',
                }}
              >
                <BillingIcon />
              </ListItemIcon>
              <ListItemText
                primary={user?.accountType === 'free' ? 'Upgrade to Pro' : 'Billing'}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: isActiveRoute('/billing') ? 600 : 500,
                    color: isActiveRoute('/billing') ? 'primary.main' : user?.accountType === 'free' ? 'success.main' : 'text.primary',
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>

        {user?.accountType === 'free' && <Divider sx={{ mx: 2, my: 2 }} />}

        {/* Settings */}
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => handleItemClick('/settings')}
              selected={isActiveRoute('/settings')}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(124, 58, 237, 0.12)',
                  '&:hover': {
                    backgroundColor: 'rgba(124, 58, 237, 0.16)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.main',
                  },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(124, 58, 237, 0.08)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: isActiveRoute('/settings') ? 'primary.main' : 'text.secondary',
                }}
              >
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText
                primary="Settings"
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: '0.875rem',
                    fontWeight: isActiveRoute('/settings') ? 600 : 400,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderTopColor: 'divider' }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: '0.75rem', textAlign: 'center' }}
        >
          ProcessLink v1.0
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: '0.75rem', textAlign: 'center' }}
        >
          {tenant?.plan && (
            <Chip
              label={tenant.plan.toUpperCase()}
              size="small"
              color={tenant.plan === 'free' ? 'default' : 'primary'}
              sx={{ mt: 0.5, fontSize: '0.625rem', height: 16 }}
            />
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default Sidebar;