import React, { createContext, useContext, useState, useCallback } from 'react';
import { Snackbar, Alert, AlertTitle, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

// Notification context
const NotificationContext = createContext();

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [nextId, setNextId] = useState(1);

  // Show notification function
  const showNotification = useCallback((message, severity = 'info', options = {}) => {
    const id = nextId;
    setNextId(prev => prev + 1);

    const notification = {
      id,
      message,
      severity,
      autoHideDuration: options.autoHideDuration || 6000,
      persist: options.persist || false,
      title: options.title || null,
      action: options.action || null,
      ...options,
    };

    setNotifications(prev => [...prev, notification]);

    // Auto remove notification if not persistent
    if (!notification.persist) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.autoHideDuration);
    }

    return id;
  }, [nextId]);

  // Remove notification function
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Shorthand methods for different severities
  const showSuccess = useCallback((message, options = {}) => {
    return showNotification(message, 'success', options);
  }, [showNotification]);

  const showError = useCallback((message, options = {}) => {
    return showNotification(message, 'error', {
      autoHideDuration: 8000, // Errors stay longer
      ...options,
    });
  }, [showNotification]);

  const showWarning = useCallback((message, options = {}) => {
    return showNotification(message, 'warning', options);
  }, [showNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return showNotification(message, 'info', options);
  }, [showNotification]);

  // Context value
  const value = {
    notifications,
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearAllNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </NotificationContext.Provider>
  );
};

// Notification container component
const NotificationContainer = ({ notifications, onClose }) => {
  return (
    <>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => onClose(notification.id)}
        />
      ))}
    </>
  );
};

// Individual notification item component
const NotificationItem = ({ notification, onClose }) => {
  const handleClose = (event, reason) => {
    if (reason === 'clickaway') return;
    onClose();
  };

  const action = (
    <>
      {notification.action}
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleClose}
        sx={{ ml: 1 }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </>
  );

  return (
    <Snackbar
      open={true}
      autoHideDuration={notification.persist ? null : notification.autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{
        '& .MuiSnackbarContent-root': {
          padding: 0,
        },
      }}
    >
      <Alert
        onClose={handleClose}
        severity={notification.severity}
        action={action}
        variant="filled"
        sx={{
          width: '100%',
          minWidth: 300,
          maxWidth: 500,
          '& .MuiAlert-message': {
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          },
        }}
      >
        {notification.title && (
          <AlertTitle>{notification.title}</AlertTitle>
        )}
        {notification.message}
      </Alert>
    </Snackbar>
  );
};

// Hook to use notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};