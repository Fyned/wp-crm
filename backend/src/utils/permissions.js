/**
 * Permission Utilities for RBAC
 * Centralized permission checking logic
 */

const supabaseAdmin = require('../config/supabase');

/**
 * Check if user can manage users (create, deactivate, reset passwords)
 * Only admin and super_admin can manage users
 */
function canManageUsers(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can manage teams (create, update, delete, add/remove members)
 * Only admin and super_admin can manage teams
 */
function canManageTeams(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can create sessions
 * Only admin and super_admin can create sessions
 */
function canCreateSessions(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can assign sessions to teams/users
 * Only admin and super_admin can assign sessions
 */
function canAssignSessions(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can delete sessions
 * Only admin (who created it) and super_admin can delete sessions
 */
function canDeleteSessions(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user is super admin
 */
function isSuperAdmin(userRole) {
  return userRole === 'super_admin';
}

/**
 * Check if user is admin (includes super_admin)
 */
function isAdmin(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Get accessible session IDs for a user based on RBAC
 * - super_admin: all sessions
 * - admin: sessions they created
 * - team_member: sessions assigned to them or their teams
 *
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<string[]|null>} Array of session IDs, or null if user can see all
 */
async function getAccessibleSessionIds(userId, role) {
  // Super admin sees all sessions
  if (role === 'super_admin') {
    return null; // null means "all sessions"
  }

  // Admin sees only their sessions
  if (role === 'admin') {
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id')
      .eq('created_by_admin_id', userId);

    return sessions?.map(s => s.id) || [];
  }

  // Team member sees assigned sessions
  if (role === 'team_member') {
    // Get user's team IDs
    const { data: teamMemberships } = await supabaseAdmin
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);

    const userTeamIds = teamMemberships?.map(tm => tm.team_id) || [];

    // Get session assignments
    let assignmentQuery = supabaseAdmin
      .from('session_assignments')
      .select('session_id');

    if (userTeamIds.length > 0) {
      assignmentQuery = assignmentQuery.or(
        `assigned_to_user_id.eq.${userId},assigned_to_team_id.in.(${userTeamIds.join(',')})`
      );
    } else {
      assignmentQuery = assignmentQuery.eq('assigned_to_user_id', userId);
    }

    const { data: assignments } = await assignmentQuery;
    return assignments?.map(a => a.session_id) || [];
  }

  return [];
}

/**
 * Check if user has access to a specific session
 *
 * @param {string} sessionId - Session ID
 * @param {object} profile - User profile {id, role}
 * @returns {Promise<boolean>}
 */
async function canAccessSession(sessionId, profile) {
  const { role, id: userId } = profile;

  // Super admin has access to everything
  if (role === 'super_admin') {
    return true;
  }

  // Check if session exists and get creator
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('created_by_admin_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    return false;
  }

  // Admin has access to sessions they created
  if (role === 'admin' && session.created_by_admin_id === userId) {
    return true;
  }

  // Team member: check assignments
  if (role === 'team_member') {
    const accessibleIds = await getAccessibleSessionIds(userId, role);
    return accessibleIds.includes(sessionId);
  }

  return false;
}

/**
 * Check if user has access to a specific team
 * - super_admin: access to all teams
 * - admin: access to teams they created
 * - team_member: access to teams they belong to
 *
 * @param {string} teamId - Team ID
 * @param {object} profile - User profile {id, role}
 * @returns {Promise<boolean>}
 */
async function canAccessTeam(teamId, profile) {
  const { role, id: userId } = profile;

  // Super admin has access to all teams
  if (role === 'super_admin') {
    return true;
  }

  // Get team info
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('created_by_admin_id')
    .eq('id', teamId)
    .single();

  if (!team) {
    return false;
  }

  // Admin has access to teams they created
  if (role === 'admin' && team.created_by_admin_id === userId) {
    return true;
  }

  // Team member: check if they belong to the team
  if (role === 'team_member') {
    const { data: membership } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    return !!membership;
  }

  return false;
}

module.exports = {
  // Role checks
  canManageUsers,
  canManageTeams,
  canCreateSessions,
  canAssignSessions,
  canDeleteSessions,
  isSuperAdmin,
  isAdmin,

  // Resource access checks
  canAccessSession,
  canAccessTeam,
  getAccessibleSessionIds,
};
