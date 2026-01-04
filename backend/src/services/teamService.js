/**
 * Team Service
 * Handles all team-related business logic
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Create a new team
 */
async function createTeam(adminId, { name, description }) {
  // Verify admin role
  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .single();

  if (!admin || !['super_admin', 'admin'].includes(admin.role)) {
    throw new Error('Only admins can create teams');
  }

  // Create team
  const { data: team, error } = await supabaseAdmin
    .from('teams')
    .insert({
      name,
      description,
      created_by_admin_id: adminId,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`[Team Service] Team created: ${team.name} by admin ${adminId}`);
  return team;
}

/**
 * Get all teams created by an admin (or all teams for super_admin)
 */
async function getTeamsByAdmin(userId) {
  // Get user role
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!user) throw new Error('User not found');

  let query = supabaseAdmin
    .from('teams')
    .select(`
      *,
      created_by:profiles!teams_created_by_admin_id_fkey(id, username, full_name),
      team_members(
        user:profiles(id, username, full_name, role)
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Super admin sees all teams, regular admin sees only their teams
  if (user.role !== 'super_admin') {
    query = query.eq('created_by_admin_id', userId);
  }

  const { data: teams, error } = await query;

  if (error) throw error;

  // Format response with member count
  const formattedTeams = teams.map(team => ({
    ...team,
    member_count: team.team_members?.length || 0
  }));

  return formattedTeams;
}

/**
 * Get team by ID with permission check
 */
async function getTeamById(teamId, userId) {
  // Get user role
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (!user) throw new Error('User not found');

  // Get team
  const { data: team, error } = await supabaseAdmin
    .from('teams')
    .select(`
      *,
      created_by:profiles!teams_created_by_admin_id_fkey(id, username, full_name),
      team_members(
        id,
        joined_at,
        user:profiles(id, username, full_name, role, is_active)
      )
    `)
    .eq('id', teamId)
    .single();

  if (error) throw error;
  if (!team) throw new Error('Team not found');

  // Permission check
  const isOwner = team.created_by_admin_id === userId;
  const isSuperAdmin = user.role === 'super_admin';
  const isMember = team.team_members.some(m => m.user.id === userId);

  if (!isOwner && !isSuperAdmin && !isMember) {
    throw new Error('You do not have permission to view this team');
  }

  return team;
}

/**
 * Update team
 */
async function updateTeam(teamId, updates, userId) {
  // Get team and verify ownership
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('created_by_admin_id')
    .eq('id', teamId)
    .single();

  if (!team) throw new Error('Team not found');

  // Get user role
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  // Only team owner or super_admin can update
  if (team.created_by_admin_id !== userId && user.role !== 'super_admin') {
    throw new Error('Only the team owner can update this team');
  }

  // Update team
  const { data: updatedTeam, error } = await supabaseAdmin
    .from('teams')
    .update({
      name: updates.name,
      description: updates.description
    })
    .eq('id', teamId)
    .select()
    .single();

  if (error) throw error;

  console.log(`[Team Service] Team updated: ${teamId} by ${userId}`);
  return updatedTeam;
}

/**
 * Delete team (soft delete - mark as inactive)
 */
async function deleteTeam(teamId, userId) {
  // Get team and verify ownership
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('created_by_admin_id, name')
    .eq('id', teamId)
    .single();

  if (!team) throw new Error('Team not found');

  // Get user role
  const { data: user } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  // Only team owner or super_admin can delete
  if (team.created_by_admin_id !== userId && user.role !== 'super_admin') {
    throw new Error('Only the team owner can delete this team');
  }

  // Soft delete (mark as inactive)
  const { error } = await supabaseAdmin
    .from('teams')
    .update({ is_active: false })
    .eq('id', teamId);

  if (error) throw error;

  console.log(`[Team Service] Team deleted: ${team.name} by ${userId}`);
  return { message: 'Team deleted successfully' };
}

/**
 * Add member to team
 */
async function addMemberToTeam(teamId, userIdToAdd, adminId) {
  // Verify team exists and admin has permission
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('created_by_admin_id, name')
    .eq('id', teamId)
    .eq('is_active', true)
    .single();

  if (!team) throw new Error('Team not found');

  // Get admin role
  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .single();

  // Only team owner or super_admin can add members
  if (team.created_by_admin_id !== adminId && admin.role !== 'super_admin') {
    throw new Error('Only the team owner can add members');
  }

  // Verify user to add exists
  const { data: userToAdd } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role')
    .eq('id', userIdToAdd)
    .eq('is_active', true)
    .single();

  if (!userToAdd) throw new Error('User not found or inactive');

  // Check if already a member
  const { data: existingMember } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userIdToAdd)
    .single();

  if (existingMember) {
    throw new Error('User is already a member of this team');
  }

  // Add member
  const { data: membership, error } = await supabaseAdmin
    .from('team_members')
    .insert({
      team_id: teamId,
      user_id: userIdToAdd
    })
    .select(`
      id,
      joined_at,
      user:profiles(id, username, full_name, role)
    `)
    .single();

  if (error) throw error;

  console.log(`[Team Service] User ${userToAdd.username} added to team ${team.name}`);
  return membership;
}

/**
 * Remove member from team
 */
async function removeMemberFromTeam(teamId, userIdToRemove, adminId) {
  // Verify team exists and admin has permission
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('created_by_admin_id, name')
    .eq('id', teamId)
    .single();

  if (!team) throw new Error('Team not found');

  // Get admin role
  const { data: admin } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .single();

  // Only team owner or super_admin can remove members
  if (team.created_by_admin_id !== adminId && admin.role !== 'super_admin') {
    throw new Error('Only the team owner can remove members');
  }

  // Remove member
  const { error } = await supabaseAdmin
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userIdToRemove);

  if (error) throw error;

  console.log(`[Team Service] User ${userIdToRemove} removed from team ${team.name}`);
  return { message: 'Member removed successfully' };
}

/**
 * Get all teams a user belongs to
 */
async function getUserTeams(userId) {
  const { data: memberships, error } = await supabaseAdmin
    .from('team_members')
    .select(`
      team:teams(
        id,
        name,
        description,
        created_at,
        created_by:profiles!teams_created_by_admin_id_fkey(id, username, full_name)
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;

  // Extract teams from memberships
  const teams = memberships.map(m => m.team).filter(t => t !== null);

  return teams;
}

/**
 * Get team members
 */
async function getTeamMembers(teamId, userId) {
  // Verify user has access to view team
  const team = await getTeamById(teamId, userId);

  return team.team_members;
}

module.exports = {
  createTeam,
  getTeamsByAdmin,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMemberToTeam,
  removeMemberFromTeam,
  getUserTeams,
  getTeamMembers
};
