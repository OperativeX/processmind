const Joi = require('joi');
const logger = require('../utils/logger');

// Helper function to handle validation
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      logger.warn('Validation error:', {
        url: req.originalUrl,
        method: req.method,
        errors: errorMessages,
        body: req.body
      });
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errorMessages
      });
    }
    
    next();
  };
};

// Authentication validation schemas
const validateAuth = {
  register: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    firstName: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters long',
        'string.max': 'First name cannot exceed 50 characters',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters long',
        'string.max': 'Last name cannot exceed 50 characters',
        'any.required': 'Last name is required'
      }),
    
    tenantName: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Organization name must be at least 2 characters long',
        'string.max': 'Organization name cannot exceed 100 characters',
        'any.required': 'Organization name is required'
      }),
    
    subdomain: Joi.string()
      .min(3)
      .max(63)
      .pattern(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/)
      .optional()
      .messages({
        'string.min': 'Subdomain must be at least 3 characters long',
        'string.max': 'Subdomain cannot exceed 63 characters',
        'string.pattern.base': 'Subdomain can only contain lowercase letters, numbers, and hyphens'
      }),
    
    source: Joi.string().optional(),
    utm_campaign: Joi.string().optional(),
    utm_source: Joi.string().optional(),
    utm_medium: Joi.string().optional()
  })),
  
  verifyRegistration: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    code: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.length': 'Verification code must be 6 digits',
        'string.pattern.base': 'Verification code must contain only numbers',
        'any.required': 'Verification code is required'
      })
  })),
  
  resendCode: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  })),
  
  checkTenant: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  })),

  checkSubdomain: validate(Joi.object({
    subdomain: Joi.string()
      .min(3)
      .max(30)
      .pattern(/^[a-z0-9-]+$/)
      .required()
      .messages({
        'string.min': 'Subdomain must be at least 3 characters long',
        'string.max': 'Subdomain cannot exceed 30 characters',
        'string.pattern.base': 'Subdomain can only contain lowercase letters, numbers, and hyphens',
        'any.required': 'Subdomain is required'
      })
  })),

  login: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      }),
    
    tenantId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid tenant ID format'
      })
  })),
  
  changePassword: validate(Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      })
  })),

  forgotPassword: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  })),

  resetPassword: validate(Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'any.required': 'Reset token is required'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      })
  })),
  
  acceptInvitation: validate(Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'any.required': 'Invitation token is required'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    firstName: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name cannot exceed 50 characters',
        'any.required': 'First name is required'
      }),
    
    lastName: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name cannot exceed 50 characters',
        'any.required': 'Last name is required'
      })
  }))
};

// Process validation schemas
const validateProcess = {
  create: validate(Joi.object({
    // File validation is handled by multer middleware
    // Any additional metadata can be validated here
  })),

  update: validate(Joi.object({
    title: Joi.string()
      .min(1)
      .max(200)
      .optional()
      .messages({
        'string.min': 'Title cannot be empty',
        'string.max': 'Title cannot exceed 200 characters'
      }),
    
    transcript: Joi.object({
      text: Joi.string().optional(),
      segments: Joi.array().items(
        Joi.object({
          start: Joi.number().min(0).required(),
          end: Joi.number().min(0).required(),
          text: Joi.string().required()
        })
      ).optional()
    }).optional(),
    
    tags: Joi.array()
      .items(Joi.object({
        name: Joi.string().min(1).max(50).required()
          .messages({
            'string.min': 'Tag name cannot be empty',
            'string.max': 'Tag name cannot exceed 50 characters',
            'any.required': 'Tag name is required'
          }),
        weight: Joi.number().min(0).max(1).optional().default(0.5)
          .messages({
            'number.min': 'Tag weight must be at least 0',
            'number.max': 'Tag weight cannot exceed 1'
          })
      }))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 20 tags'
      }),
    
    todoList: Joi.array()
      .items(Joi.object({
        task: Joi.string().min(1).max(500).required(),
        timestamp: Joi.number().min(0).optional().allow(null),
        completed: Joi.boolean().optional().default(false),
        id: Joi.alternatives().try(
          Joi.string(),
          Joi.object()
        ).optional(),
        _id: Joi.alternatives().try(
          Joi.string(),
          Joi.object()
        ).optional(),
        createdAt: Joi.alternatives().try(
          Joi.date(),
          Joi.string()
        ).optional()
      }).unknown(true))
      .max(100)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 100 todo items'
      })
  }))
};

// FavoriteList validation schemas
const validateFavoriteList = {
  create: validate(Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'List name cannot be empty',
        'string.max': 'List name cannot exceed 100 characters',
        'any.required': 'List name is required'
      }),
    
    description: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g., #7c3aed)'
      }),
    
    processes: Joi.array()
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
      .max(1000)
      .optional()
      .messages({
        'array.max': 'Cannot add more than 1000 processes to a single list',
        'string.pattern.base': 'Invalid process ID format'
      })
  })),

  update: validate(Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .optional()
      .messages({
        'string.min': 'List name cannot be empty',
        'string.max': 'List name cannot exceed 100 characters'
      }),
    
    description: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g., #7c3aed)'
      })
  })),

  addProcess: validate(Joi.object({
    processId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid process ID format',
        'any.required': 'Process ID is required'
      })
  })),

  bulkAddProcesses: validate(Joi.object({
    processIds: Joi.array()
      .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one process ID is required',
        'array.max': 'Cannot add more than 100 processes at once',
        'string.pattern.base': 'Invalid process ID format',
        'any.required': 'Process IDs array is required'
      })
  })),

  shareList: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    message: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Message cannot exceed 500 characters'
      })
  }))
};

// Team validation schemas
const validateTeam = {
  inviteUser: validate(Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    role: Joi.string()
      .valid('admin', 'user')
      .optional()
      .default('user')
      .messages({
        'any.only': 'Role must be either admin or user'
      }),
    
    message: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Message cannot exceed 500 characters'
      })
  })),
  
  updateRole: validate(Joi.object({
    role: Joi.string()
      .valid('admin', 'user')
      .required()
      .messages({
        'any.only': 'Role must be either admin or user',
        'any.required': 'Role is required'
      })
  }))
};

module.exports = {
  validateAuth,
  validateProcess,
  validateFavoriteList,
  validateTeam
};