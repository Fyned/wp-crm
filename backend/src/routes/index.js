/**
 * API Routes
 */

const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const sessionController = require('../controllers/sessionController');
const messageController = require('../controllers/messageController');
const webhookController = require('../controllers/webhookController');

// Middlewares
const { authenticate, isAdmin, isSuperAdmin } = require('../middlewares/auth');
const {
  validateLogin,
  validateCreateUser,
  validateResetPassword,
  validateCreateSession,
  validateRequestPairingCode,
  validateAssignSession,
  validateSendMessage,
  validateGetMessages
} = require('../middlewares/validator');

// ===== Public Routes =====

// Auth
router.post('/auth/login', validateLogin, authController.login);
router.post('/auth/refresh', authController.refreshToken);

// Webhooks (no auth - validated by webhook secret)
router.post('/webhooks/waha', webhookController.handleWahaWebhook);

// ===== Protected Routes (require authentication) =====

router.use(authenticate); // All routes below require authentication

// Auth - Current user
router.get('/auth/me', authController.getCurrentUser);
router.post('/auth/logout', authController.logout);

// ===== User Management (Admin only) =====

router.post('/users', isAdmin, validateCreateUser, userController.createUser);
router.get('/users', isAdmin, userController.getUsers);
router.get('/users/:userId', isAdmin, userController.getUserById);
router.post('/users/:userId/reset-password', isAdmin, validateResetPassword, userController.resetPassword);
router.delete('/users/:userId', isAdmin, userController.deactivateUser);
router.post('/users/:userId/reactivate', isAdmin, userController.reactivateUser);

// ===== Session Management =====

router.post('/sessions', isAdmin, validateCreateSession, sessionController.createSession);
router.get('/sessions', sessionController.getSessions);
router.get('/sessions/:sessionId/qr', sessionController.getQRCode);
router.post('/sessions/:sessionId/pairing-code', validateRequestPairingCode, sessionController.requestPairingCode);
router.post('/sessions/:sessionId/assign', isAdmin, validateAssignSession, sessionController.assignSession);
router.delete('/sessions/:sessionId', isAdmin, sessionController.deleteSession);

// ===== Messaging =====

router.get('/sessions/:sessionId/chats', messageController.getChats);
router.get('/sessions/:sessionId/contacts/:contactId/messages', validateGetMessages, messageController.getMessages);
router.post('/sessions/:sessionId/messages', validateSendMessage, messageController.sendMessage);
router.post('/sessions/:sessionId/contacts/:contactId/read', messageController.markAsRead);
router.get('/sessions/:sessionId/search', messageController.searchMessages);

// ===== Health Check =====

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;
