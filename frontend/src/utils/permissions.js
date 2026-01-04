/**
 * Frontend Permission Utilities
 * UI element visibility and permission checks based on user role
 */

/**
 * Check if user can manage other users (create, deactivate, reset passwords)
 * Only admin and super_admin can manage users
 */
export function canManageUsers(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can manage teams (create, update, delete, add/remove members)
 * Only admin and super_admin can manage teams
 */
export function canManageTeams(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can create sessions
 * Only admin and super_admin can create sessions
 */
export function canCreateSessions(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can assign sessions to teams/users
 * Only admin and super_admin can assign sessions
 */
export function canAssignSessions(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can delete sessions
 * Only admin (who created it) and super_admin can delete sessions
 */
export function canDeleteSessions(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can edit session metadata
 * Only admin and super_admin can edit session metadata
 */
export function canEditSessionMetadata(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user is super admin
 */
export function isSuperAdmin(userRole) {
  return userRole === 'super_admin';
}

/**
 * Check if user is admin (includes super_admin)
 */
export function isAdmin(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user is team member
 */
export function isTeamMember(userRole) {
  return userRole === 'team_member';
}

/**
 * Check if user can send messages
 * All authenticated users can send messages
 */
export function canSendMessages(userRole) {
  return ['admin', 'super_admin', 'team_member'].includes(userRole);
}

/**
 * Check if user can view admin panel
 * Only admin and super_admin can access admin panel
 */
export function canAccessAdminPanel(userRole) {
  return ['admin', 'super_admin'].includes(userRole);
}

/**
 * Check if user can view teams page
 * All authenticated users can view teams
 */
export function canAccessTeamsPage(userRole) {
  return ['admin', 'super_admin', 'team_member'].includes(userRole);
}

/**
 * Get user role display name
 */
export function getRoleDisplayName(role) {
  const roleNames = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    team_member: 'Team Member',
  };
  return roleNames[role] || role;
}

/**
 * Get available features based on role
 */
export function getAvailableFeatures(userRole) {
  const features = {
    canManageUsers: canManageUsers(userRole),
    canManageTeams: canManageTeams(userRole),
    canCreateSessions: canCreateSessions(userRole),
    canAssignSessions: canAssignSessions(userRole),
    canDeleteSessions: canDeleteSessions(userRole),
    canEditSessionMetadata: canEditSessionMetadata(userRole),
    canSendMessages: canSendMessages(userRole),
    canAccessAdminPanel: canAccessAdminPanel(userRole),
    canAccessTeamsPage: canAccessTeamsPage(userRole),
    isSuperAdmin: isSuperAdmin(userRole),
    isAdmin: isAdmin(userRole),
    isTeamMember: isTeamMember(userRole),
  };

  return features;
}

/**
 * Hook: Get permissions for current user
 * Usage: const permissions = usePermissions(user?.role);
 */
export function usePermissions(userRole) {
  if (!userRole) {
    return {
      canManageUsers: false,
      canManageTeams: false,
      canCreateSessions: false,
      canAssignSessions: false,
      canDeleteSessions: false,
      canEditSessionMetadata: false,
      canSendMessages: false,
      canAccessAdminPanel: false,
      canAccessTeamsPage: false,
      isSuperAdmin: false,
      isAdmin: false,
      isTeamMember: false,
    };
  }

  return getAvailableFeatures(userRole);
}

export default {
  canManageUsers,
  canManageTeams,
  canCreateSessions,
  canAssignSessions,
  canDeleteSessions,
  canEditSessionMetadata,
  isSuperAdmin,
  isAdmin,
  isTeamMember,
  canSendMessages,
  canAccessAdminPanel,
  canAccessTeamsPage,
  getRoleDisplayName,
  getAvailableFeatures,
  usePermissions,
};
