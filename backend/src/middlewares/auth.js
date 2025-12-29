/**
 * Authentication Middleware
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Fetch user profile with role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User profile not found'
      });
    }

    if (!profile.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated'
      });
    }

    // Attach user and profile to request
    req.user = user;
    req.profile = profile;
    req.accessToken = token;

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Require specific role(s)
 * @param {string|string[]} roles - Required role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.profile.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires one of the following roles: ${roles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Check if user is Super Admin
 */
function isSuperAdmin(req, res, next) {
  if (req.profile?.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Super Admin access required'
    });
  }
  next();
}

/**
 * Check if user is Admin or Super Admin
 */
function isAdmin(req, res, next) {
  if (!['admin', 'super_admin'].includes(req.profile?.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
}

module.exports = {
  authenticate,
  requireRole,
  isSuperAdmin,
  isAdmin
};
