import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Badge
} from '@mui/material';
import {
  Dashboard,
  Business,
  Settings,
  ExitToApp,
  Shield,
  Menu as MenuIcon,
  AttachMoney,
  Analytics,
  Notifications
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const drawerWidth = 280;

const StyledDrawer = styled(Drawer)({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    backgroundColor: '#161b22',
    borderRight: '1px solid #30363d'
  }
});

const StyledAppBar = styled(AppBar)({
  backgroundColor: '#0d1117',
  borderBottom: '1px solid #30363d',
  boxShadow: 'none'
});

const SuperAdminLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/super-admin/dashboard'
    },
    {
      text: 'Tenants',
      icon: <Business />,
      path: '/super-admin/tenants'
    },
    {
      text: 'Analytics',
      icon: <Analytics />,
      path: '/super-admin/analytics'
    },
    {
      text: 'Pricing Settings',
      icon: <AttachMoney />,
      path: '/super-admin/pricing'
    },
    {
      text: 'System Settings',
      icon: <Settings />,
      path: '/super-admin/settings'
    }
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    navigate('/super-admin/login');
  };

  const drawer = (
    <>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Shield sx={{ fontSize: 40, color: '#ff4444' }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Super Admin
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ProcessLink Control
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ borderColor: '#30363d' }} />
      
      <List sx={{ px: 2, py: 2 }}>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            button
            onClick={() => navigate(item.path)}
            sx={{
              borderRadius: 1,
              mb: 1,
              backgroundColor: location.pathname === item.path ? '#1f2428' : 'transparent',
              '&:hover': {
                backgroundColor: '#1f2428'
              }
            }}
          >
            <ListItemIcon sx={{ color: '#ff4444', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.text}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: location.pathname === item.path ? 600 : 400
              }}
            />
          </ListItem>
        ))}
      </List>
      
      <Box sx={{ flexGrow: 1 }} />
      
      <Divider sx={{ borderColor: '#30363d' }} />
      
      <List sx={{ px: 2, py: 2 }}>
        <ListItem
          button
          onClick={handleLogout}
          sx={{
            borderRadius: 1,
            '&:hover': {
              backgroundColor: '#1f2428'
            }
          }}
        >
          <ListItemIcon sx={{ color: '#ff4444', minWidth: 40 }}>
            <ExitToApp />
          </ListItemIcon>
          <ListItemText 
            primary="Logout"
            primaryTypographyProps={{ fontSize: 14 }}
          />
        </ListItem>
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0d1117' }}>
      <StyledAppBar position="fixed">
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname)?.text || 'Super Admin'}
          </Typography>
          
          <IconButton color="inherit" sx={{ mr: 2 }}>
            <Badge badgeContent={3} color="error">
              <Notifications />
            </Badge>
          </IconButton>
          
          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ p: 0 }}
          >
            <Avatar sx={{ bgcolor: '#ff4444' }}>SA</Avatar>
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              sx: {
                backgroundColor: '#1a1a1a',
                border: '1px solid #30363d'
              }
            }}
          >
            <MenuItem disabled>
              <Typography variant="caption">
                {localStorage.getItem('superAdminEmail') || 'admin@processlink.com'}
              </Typography>
            </MenuItem>
            <Divider sx={{ borderColor: '#30363d' }} />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <ExitToApp fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </StyledAppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: '#161b22',
              borderRight: '1px solid #30363d'
            }
          }}
        >
          {drawer}
        </Drawer>
        
        <StyledDrawer
          variant="permanent"
          sx={{ display: { xs: 'none', sm: 'block' } }}
          open
        >
          {drawer}
        </StyledDrawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          backgroundColor: '#0d1117',
          minHeight: '100vh'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default SuperAdminLayout;