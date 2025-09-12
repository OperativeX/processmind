import React from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  IconButton,
  Divider,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';
import ProcessLinkLogo from '../Common/ProcessLinkLogo';

const PublicFooter = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    produkt: [
      { label: 'Funktionen', path: '/features' },
      { label: 'Preise', path: '/pricing' },
      { label: 'Anwendungsfälle', path: '/features#use-cases' },
      { label: 'Integrationen', path: '/features#integrations' },
    ],
    unternehmen: [
      { label: 'Über uns', path: '/about' },
      { label: 'Kontakt', path: '/contact' },
      { label: 'Blog', path: '/blog' },
      { label: 'Karriere', path: '/careers' },
    ],
    ressourcen: [
      { label: 'Dokumentation', path: '/docs' },
      { label: 'API-Referenz', path: '/api' },
      { label: 'Community', path: '/community' },
      { label: 'Support', path: '/support' },
    ],
    rechtliches: [
      { label: 'Datenschutzrichtlinie', path: '/privacy' },
      { label: 'Nutzungsbedingungen', path: '/terms' },
      { label: 'Cookie-Richtlinie', path: '/cookies' },
      { label: 'DSGVO', path: '/gdpr' },
    ],
  };

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Grid container spacing={4}>
          {/* Brand Section */}
          <Grid item xs={12} md={4}>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <ProcessLinkLogo size={36} />
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  ProcessLink
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Verwandeln Sie Ihre Videoinhalte in strukturiertes Wissen mit KI-gestützter Transkription und Analyse.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <GitHubIcon />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <LinkedInIcon />
                </IconButton>
                <IconButton
                  size="small"
                  sx={{
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <TwitterIcon />
                </IconButton>
              </Box>
            </Box>
          </Grid>

          {/* Links Sections */}
          <Grid item xs={12} md={8}>
            <Grid container spacing={4}>
              {Object.entries(footerLinks).map(([category, links]) => (
                <Grid item xs={6} sm={3} key={category}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      mb: 2,
                      textTransform: 'capitalize',
                      color: 'text.primary',
                    }}
                  >
                    {category}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {links.map((link) => (
                      <Typography
                        key={link.label}
                        component={Link}
                        to={link.path}
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          textDecoration: 'none',
                          '&:hover': {
                            color: 'primary.main',
                          },
                        }}
                      >
                        {link.label}
                      </Typography>
                    ))}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>

        <Divider sx={{ my: 6 }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            © {currentYear} ProcessLink. Alle Rechte vorbehalten.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Typography
              component={Link}
              to="/privacy"
              variant="body2"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Datenschutz
            </Typography>
            <Typography
              component={Link}
              to="/terms"
              variant="body2"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Nutzungsbedingungen
            </Typography>
            <Typography
              component={Link}
              to="/cookies"
              variant="body2"
              sx={{
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Cookies
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default PublicFooter;