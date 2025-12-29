/**
 * Request Validation Middleware
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  }
  next();
}

// ===== User Validation =====

const validateCreateUser = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),

  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),

  body('role')
    .isIn(['admin', 'team_member'])
    .withMessage('Role must be admin or team_member'),

  handleValidationErrors
];

const validateResetPassword = [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID'),

  body('new_password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),

  handleValidationErrors
];

// ===== Team Validation =====

const validateCreateTeam = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Team name must be 2-100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be max 500 characters'),

  handleValidationErrors
];

const validateAddTeamMember = [
  param('teamId')
    .isUUID()
    .withMessage('Invalid team ID'),

  body('user_id')
    .isUUID()
    .withMessage('Invalid user ID'),

  handleValidationErrors
];

// ===== Session Validation =====

const validateCreateSession = [
  body('session_name')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Session name must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Session name can only contain letters, numbers, underscores, and hyphens'),

  handleValidationErrors
];

const validateRequestPairingCode = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),

  body('phone_number')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format (E.164)'),

  handleValidationErrors
];

const validateAssignSession = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),

  body('assigned_to_user_id')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID'),

  body('assigned_to_team_id')
    .optional()
    .isUUID()
    .withMessage('Invalid team ID'),

  body()
    .custom((value, { req }) => {
      if (!req.body.assigned_to_user_id && !req.body.assigned_to_team_id) {
        throw new Error('Must assign to either user or team');
      }
      if (req.body.assigned_to_user_id && req.body.assigned_to_team_id) {
        throw new Error('Cannot assign to both user and team');
      }
      return true;
    }),

  handleValidationErrors
];

// ===== Message Validation =====

const validateSendMessage = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),

  body('phone_number')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  body('message')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Message must be 1-10000 characters'),

  body('message_type')
    .optional()
    .isIn(['text', 'image', 'video', 'audio', 'document'])
    .withMessage('Invalid message type'),

  handleValidationErrors
];

const validateGetMessages = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID'),

  param('contactId')
    .isUUID()
    .withMessage('Invalid contact ID'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100'),

  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be >= 0'),

  handleValidationErrors
];

// ===== Login Validation =====

const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateCreateUser,
  validateResetPassword,
  validateCreateTeam,
  validateAddTeamMember,
  validateCreateSession,
  validateRequestPairingCode,
  validateAssignSession,
  validateSendMessage,
  validateGetMessages,
  validateLogin
};
