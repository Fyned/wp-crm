/**
 * WhatsApp CRM Backend Server
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (required for rate limiting behind Nginx/reverse proxy)
app.set('trust proxy', 1);

// ===== Security Middleware =====

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// ===== Body Parsing =====

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== Compression =====

app.use(compression());

// ===== Logging =====

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ===== Routes =====

app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WhatsApp CRM API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/health'
  });
});

// ===== Error Handling =====

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===== Start Server =====

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║         🚀 WhatsApp CRM Backend Server Started            ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Environment:  ${process.env.NODE_ENV?.padEnd(42) || 'development'.padEnd(42)}║`);
  console.log(`║  Port:         ${PORT.toString().padEnd(42)}║`);
  console.log(`║  API URL:      http://localhost:${PORT}/api${' '.repeat(20)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  📚 Endpoints:                                            ║');
  console.log('║    POST   /api/auth/login                                 ║');
  console.log('║    GET    /api/auth/me                                    ║');
  console.log('║    POST   /api/users                                      ║');
  console.log('║    POST   /api/sessions                                   ║');
  console.log('║    GET    /api/sessions/:id/chats                         ║');
  console.log('║    POST   /api/webhooks/waha                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
