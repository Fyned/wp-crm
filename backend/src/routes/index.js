/**
 * API Routes
 */

const express = require('express');
const router = express.Router();

// Controllers
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const sessionController = require('../controllers/sessionController.evolution');
const messageController = require('../controllers/messageController.evolution');
const webhookController = require('../controllers/webhookController.evolution');
const syncController = require('../controllers/syncController');

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
router.post('/webhooks/evolution', webhookController.handleEvolutionWebhook);
router.get('/webhooks/health', webhookController.webhookHealth);

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
router.get('/sessions/:sessionId', sessionController.getSessionDetails);
router.get('/sessions/:sessionId/qr', sessionController.getSessionQRCode);
router.post('/sessions/:sessionId/pairing-code', validateRequestPairingCode, sessionController.requestSessionPairingCode);
router.post('/sessions/:sessionId/reconnect', sessionController.reconnectSession); // NEW: Reconnect disconnected session
router.post('/sessions/:sessionId/assign', isAdmin, validateAssignSession, sessionController.assignSession);
router.delete('/sessions/:sessionId', isAdmin, sessionController.deleteSession);

// ===== Message Synchronization =====

router.post('/sessions/:sessionId/sync/initial', isAdmin, syncController.triggerInitialSync);
router.post('/sessions/:sessionId/sync/gap-fill', isAdmin, syncController.triggerGapFill);
router.get('/sessions/:sessionId/sync/status', syncController.getSyncStatus);

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
