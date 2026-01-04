/**
 * Team Controller
 * Handles HTTP requests for team management
 */

const teamService = require('../services/teamService');

/**
 * Create a new team
 * POST /api/teams
 */
async function createTeam(req, res) {
  try {
    const adminId = req.user.id;
    const { name, description } = req.body;

    const team = await teamService.createTeam(adminId, { name, description });

    res.status(201).json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('[Team Controller] Create team error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get all teams (for current user)
 * GET /api/teams
 */
async function getTeams(req, res) {
  try {
    const userId = req.user.id;

    const teams = await teamService.getTeamsByAdmin(userId);

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('[Team Controller] Get teams error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get team by ID
 * GET /api/teams/:teamId
 */
async function getTeamById(req, res) {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;

    const team = await teamService.getTeamById(teamId, userId);

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('[Team Controller] Get team error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Update team
 * PUT /api/teams/:teamId
 */
async function updateTeam(req, res) {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const updates = req.body;

    const team = await teamService.updateTeam(teamId, updates, userId);

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('[Team Controller] Update team error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Delete team
 * DELETE /api/teams/:teamId
 */
async function deleteTeam(req, res) {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;

    const result = await teamService.deleteTeam(teamId, userId);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('[Team Controller] Delete team error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Add member to team
 * POST /api/teams/:teamId/members
 */
async function addMember(req, res) {
  try {
    const adminId = req.user.id;
    const { teamId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const membership = await teamService.addMemberToTeam(teamId, userId, adminId);

    res.status(201).json({
      success: true,
      data: membership
    });
  } catch (error) {
    console.error('[Team Controller] Add member error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Remove member from team
 * DELETE /api/teams/:teamId/members/:userId
 */
async function removeMember(req, res) {
  try {
    const adminId = req.user.id;
    const { teamId, userId } = req.params;

    const result = await teamService.removeMemberFromTeam(teamId, userId, adminId);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('[Team Controller] Remove member error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get team members
 * GET /api/teams/:teamId/members
 */
async function getMembers(req, res) {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;

    const members = await teamService.getTeamMembers(teamId, userId);

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('[Team Controller] Get members error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get user's teams
 * GET /api/teams/my-teams
 */
async function getMyTeams(req, res) {
  try {
    const userId = req.user.id;

    const teams = await teamService.getUserTeams(userId);

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('[Team Controller] Get my teams error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  getMembers,
  getMyTeams
};
