import { createTheme } from '@mui/material/styles';

// Obsidian-inspired color palette
const colors = {
  primary: {
    50: '#f3f0ff',
    100: '#e9e2ff',
    200: '#d6cbff',
    300: '#b8a6ff',
    400: '#9575ff',
    500: '#7c3aed', // Main brand color
    600: '#6b21a8',
    700: '#581c87',
    800: '#4c1d95',
    900: '#3730a3',
  },
  dark: {
    background: {
      primary: '#0d1117',    // Main background
      secondary: '#161b22',  // Cards, sidebars
      tertiary: '#21262d',   // Elevated elements
      paper: '#161b22',      // Paper elements
    },
    text: {
      primary: '#f0f6fc',    // Primary text
      secondary: '#8b949e',  // Secondary text
      muted: '#6e7681',      // Muted text
      disabled: '#484f58',   // Disabled text
    },
    border: {
      primary: '#30363d',    // Primary borders
      secondary: '#21262d',  // Secondary borders
      focus: '#1f6feb',      // Focus borders
    },
    accent: {
      purple: '#7c3aed',
      blue: '#2563eb',
      green: '#16a34a',
      orange: '#ea580c',
      red: '#dc2626',
      yellow: '#ca8a04',
    }
  }
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary[500],
      light: colors.primary[400],
      dark: colors.primary[600],
      contrastText: '#ffffff',
    },
    secondary: {
      main: colors.dark.accent.blue,
      light: '#3b82f6',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    error: {
      main: colors.dark.accent.red,
      light: '#ef4444',
      dark: '#b91c1c',
    },
    warning: {
      main: colors.dark.accent.orange,
      light: '#f97316',
      dark: '#c2410c',
    },
    success: {
      main: colors.dark.accent.green,
      light: '#22c55e',
      dark: '#15803d',
    },
    info: {
      main: colors.dark.accent.blue,
      light: '#3b82f6',
      dark: '#1d4ed8',
    },
    background: {
      default: colors.dark.background.primary,
      paper: colors.dark.background.paper,
    },
    text: {
      primary: colors.dark.text.primary,
      secondary: colors.dark.text.secondary,
      disabled: colors.dark.text.disabled,
    },
    divider: colors.dark.border.primary,
    action: {
      hover: 'rgba(124, 58, 237, 0.08)',
      selected: 'rgba(124, 58, 237, 0.12)',
      disabled: colors.dark.text.disabled,
      disabledBackground: colors.dark.background.secondary,
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Oxygen',
      'Ubuntu',
      'Cantarell',
      '"Open Sans"',
      '"Helvetica Neue"',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.025em',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
      color: colors.dark.text.secondary,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      color: colors.dark.text.muted,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: '0.025em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${colors.dark.border.primary} ${colors.dark.background.primary}`,
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: colors.dark.background.primary,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: colors.dark.border.primary,
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: colors.dark.text.muted,
            },
          },
        },
        '*': {
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: colors.dark.border.primary,
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: colors.dark.text.muted,
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        },
        contained: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          },
        },
        outlined: {
          borderColor: colors.dark.border.primary,
          '&:hover': {
            borderColor: colors.primary[500],
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colors.dark.background.secondary,
          border: `1px solid ${colors.dark.border.primary}`,
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: colors.dark.border.focus,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: colors.dark.background.paper,
          border: `1px solid ${colors.dark.border.primary}`,
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        },
        elevation2: {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.15)',
        },
        elevation3: {
          boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: colors.dark.background.tertiary,
            borderRadius: '6px',
            '& fieldset': {
              borderColor: colors.dark.border.primary,
            },
            '&:hover fieldset': {
              borderColor: colors.dark.border.focus,
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary[500],
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root': {
            color: colors.dark.text.secondary,
            '&.Mui-focused': {
              color: colors.primary[500],
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.dark.background.secondary,
          borderBottom: `1px solid ${colors.dark.border.primary}`,
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.dark.background.secondary,
          borderColor: colors.dark.border.primary,
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(124, 58, 237, 0.12)',
            '&:hover': {
              backgroundColor: 'rgba(124, 58, 237, 0.16)',
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: colors.dark.background.tertiary,
          border: `1px solid ${colors.dark.border.primary}`,
          '&:hover': {
            backgroundColor: colors.dark.background.paper,
          },
        },
        filled: {
          '&.MuiChip-colorPrimary': {
            backgroundColor: colors.primary[500],
            '&:hover': {
              backgroundColor: colors.primary[600],
            },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: colors.dark.background.tertiary,
          border: `1px solid ${colors.dark.border.primary}`,
          fontSize: '0.75rem',
          borderRadius: '4px',
        },
        arrow: {
          color: colors.dark.background.tertiary,
          '&::before': {
            border: `1px solid ${colors.dark.border.primary}`,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.dark.background.secondary,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: colors.dark.background.tertiary,
          borderRadius: '4px',
        },
        bar: {
          borderRadius: '4px',
        },
      },
    },
  },
});

export default theme;