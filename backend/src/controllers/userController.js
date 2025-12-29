/**
 * User Management Controller
 * Handles hierarchical user creation and management
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Create a new user (Admin or Team Member)
 * POST /api/users
 */
async function createUser(req, res) {
  try {
    const { username, password, full_name, role } = req.body;
    const creatorRole = req.profile.role;
    const creatorId = req.profile.id;

    // Validate role permissions
    if (creatorRole === 'super_admin') {
      // Super admin can create both admins and team members
      if (!['admin', 'team_member'].includes(role)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Super admin can only create admin or team_member roles'
        });
      }
    } else if (creatorRole === 'admin') {
      // Admin can only create team members
      if (role !== 'team_member') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admins can only create team members'
        });
      }
    } else {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins and super admins can create users'
      });
    }

    // Check if username already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists'
      });
    }

    // Create auth user with email format: username@system.local
    const email = `${username}@system.local`;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        role,
        created_by_admin_id: creatorId
      }
    });

    if (authError) {
      console.error('[User] Auth creation error:', authError);
      return res.status(400).json({
        error: 'Bad Request',
        message: authError.message
      });
    }

    // Update profile with full name
    if (full_name) {
      await supabaseAdmin
        .from('profiles')
        .update({ full_name })
        .eq('id', authUser.user.id);
    }

    // Fetch created profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.user.id)
      .single();

    res.status(201).json({
      success: true,
      data: {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        role: profile.role,
        created_at: profile.created_at
      }
    });
  } catch (error) {
    console.error('[User] Create user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create user'
    });
  }
}

/**
 * Get all users created by current admin
 * GET /api/users
 */
async function getUsers(req, res) {
  try {
    const { role: userRole, id: userId } = req.profile;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, username, full_name, role, is_active, last_login_at, created_at');

    // Apply RLS-like filtering based on role
    if (userRole === 'super_admin') {
      // Super admin sees everyone
    } else if (userRole === 'admin') {
      // Admin sees only users they created
      query = query.eq('created_by_admin_id', userId);
    } else {
      // Team members cannot list users
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    const { data: users, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('[User] Get users error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch users'
    });
  }
}

/**
 * Get user by ID
 * GET /api/users/:userId
 */
async function getUserById(req, res) {
  try {
    const { userId } = req.params;
    const { role: currentRole, id: currentUserId } = req.profile;

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Check permissions
    if (currentRole !== 'super_admin' && user.created_by_admin_id !== currentUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view users you created'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('[User] Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch user'
    });
  }
}

/**
 * Reset user password
 * POST /api/users/:userId/reset-password
 */
async function resetPassword(req, res) {
  try {
    const { userId } = req.params;
    const { new_password } = req.body;
    const { role: currentRole, id: currentUserId } = req.profile;

    // Fetch target user
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Check permissions
    if (currentRole !== 'super_admin' && targetUser.created_by_admin_id !== currentUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only reset passwords for users you created'
      });
    }

    // Update password using Supabase Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: new_password }
    );

    if (updateError) {
      console.error('[User] Password reset error:', updateError);
      return res.status(400).json({
        error: 'Bad Request',
        message: updateError.message
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('[User] Reset password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset password'
    });
  }
}

/**
 * Deactivate user
 * DELETE /api/users/:userId
 */
async function deactivateUser(req, res) {
  try {
    const { userId } = req.params;
    const { role: currentRole, id: currentUserId } = req.profile;

    // Fetch target user
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Check permissions
    if (currentRole !== 'super_admin' && targetUser.created_by_admin_id !== currentUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only deactivate users you created'
      });
    }

    // Deactivate user
    const { error: deactivateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId);

    if (deactivateError) {
      throw deactivateError;
    }

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('[User] Deactivate user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to deactivate user'
    });
  }
}

/**
 * Reactivate user
 * POST /api/users/:userId/reactivate
 */
async function reactivateUser(req, res) {
  try {
    const { userId } = req.params;
    const { role: currentRole, id: currentUserId } = req.profile;

    // Fetch target user
    const { data: targetUser } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    // Check permissions
    if (currentRole !== 'super_admin' && targetUser.created_by_admin_id !== currentUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    // Reactivate user
    await supabaseAdmin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', userId);

    res.json({
      success: true,
      message: 'User reactivated successfully'
    });
  } catch (error) {
    console.error('[User] Reactivate user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reactivate user'
    });
  }
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  resetPassword,
  deactivateUser,
  reactivateUser
};
