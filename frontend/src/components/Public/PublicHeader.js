import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ProcessLinkLogo from '../Common/ProcessLinkLogo';

const PublicHeader = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: 'Funktionen', path: '/features' },
    { label: 'Preise', path: '/pricing' },
    { label: 'Über uns', path: '/about' },
    { label: 'Kontakt', path: '/contact' },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ height: 64, maxWidth: '1200px', width: '100%', mx: 'auto' }}>
        {/* Logo and Brand */}
        <Box
          component={Link}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none',
            color: 'inherit',
            gap: 1.5,
          }}
        >
          <ProcessLinkLogo size={40} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            ProcessLink
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        {!isMobile && (
          <>
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
              {menuItems.map((item) => (
                <Button
                  key={item.label}
                  onClick={() => handleNavigate(item.path)}
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    px: 2,
                    '&:hover': {
                      color: 'text.primary',
                      backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                  },
                }}
              >
                Anmelden
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/register')}
                sx={{
                  background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #6b21a8 30%, #9333ea 90%)',
                  },
                }}
              >
                Jetzt starten
              </Button>
            </Box>
          </>
        )}

        {/* Mobile Menu Button */}
        {isMobile && (
          <>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          </>
        )}
      </Toolbar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            backgroundColor: 'background.paper',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 700 }}>
            Menü
          </Typography>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton onClick={() => handleNavigate(item.path)}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleNavigate('/login')}
            >
              Anmelden
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={() => handleNavigate('/register')}
              sx={{
                background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
              }}
            >
              Get Started
            </Button>
          </Box>
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default PublicHeader;