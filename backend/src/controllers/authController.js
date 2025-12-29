/**
 * Authentication Controller
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Login with username and password
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // Find user by username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, is_active')
      .eq('username', username)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid username or password'
      });
    }

    if (!profile.is_active) {
      return res.status(403).json({
        error: 'Account Deactivated',
        message: 'Your account has been deactivated. Please contact your administrator.'
      });
    }

    // Authenticate with Supabase Auth
    // Convert username to email format (username@system.local)
    const email = `${username}@system.local`;

    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('[Auth] Login error:', authError);
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid username or password'
      });
    }

    // Update last login timestamp
    await supabaseAdmin
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', profile.id);

    // Return user data and access token
    res.json({
      success: true,
      data: {
        user: {
          id: profile.id,
          username: profile.username,
          role: profile.role
        },
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at
      }
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed'
    });
  }
}

/**
 * Get current user profile
 * GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        username,
        full_name,
        role,
        is_active,
        last_login_at,
        created_at
      `)
      .eq('id', req.user.id)
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('[Auth] Get current user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user profile'
    });
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
async function refreshToken(req, res) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required'
      });
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token'
      });
    }

    res.json({
      success: true,
      data: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('[Auth] Refresh token error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token refresh failed'
    });
  }
}

/**
 * Logout
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    await supabaseAdmin.auth.signOut();

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Logout failed'
    });
  }
}

module.exports = {
  login,
  getCurrentUser,
  refreshToken,
  logout
};
