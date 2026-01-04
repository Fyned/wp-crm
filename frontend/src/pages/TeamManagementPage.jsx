/**
 * Team Management Page
 * Allows admins to create and manage teams
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamAPI, userAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function TeamManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const response = await teamAPI.getTeams();
      setTeams(response.data || []);
    } catch (error) {
      toast.error('Failed to fetch teams');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = () => {
    setShowCreateModal(true);
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    setShowEditModal(true);
  };

  const handleViewMembers = (team) => {
    setSelectedTeam(team);
    setShowMembersModal(true);
  };

  const handleDeleteTeam = async (team) => {
    if (!confirm(`Are you sure you want to delete team "${team.name}"?`)) {
      return;
    }

    try {
      await teamAPI.deleteTeam(team.id);
      toast.success('Team deleted successfully');
      fetchTeams();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete team');
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-wa-bg">
      {/* Header */}
      <div className="bg-wa-panel border-b border-wa-border p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/chat')}
              className="p-2 hover:bg-wa-hover rounded-lg transition"
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                <UserGroupIcon className="w-8 h-8" />
                <span>Team Management</span>
              </h1>
              <p className="text-gray-400">Create and manage teams</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={handleCreateTeam}
              className="flex items-center space-x-2 bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-lg transition"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Create Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Teams List */}
      <div className="max-w-7xl mx-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Loading teams...</div>
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-wa-panel rounded-lg border border-wa-border p-12 text-center">
            <UserGroupIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No teams yet</h3>
            <p className="text-gray-400 mb-4">
              {isAdmin
                ? 'Create your first team to get started'
                : 'You are not a member of any team yet'}
            </p>
            {isAdmin && (
              <button
                onClick={handleCreateTeam}
                className="bg-primary-500 hover:bg-primary-600 px-4 py-2 rounded-lg transition"
              >
                Create Team
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                isAdmin={isAdmin}
                onEdit={() => handleEditTeam(team)}
                onDelete={() => handleDeleteTeam(team)}
                onViewMembers={() => handleViewMembers(team)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTeams();
          }}
        />
      )}

      {showEditModal && selectedTeam && (
        <EditTeamModal
          team={selectedTeam}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTeam(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedTeam(null);
            fetchTeams();
          }}
        />
      )}

      {showMembersModal && selectedTeam && (
        <TeamMembersModal
          team={selectedTeam}
          isAdmin={isAdmin}
          onClose={() => {
            setShowMembersModal(false);
            setSelectedTeam(null);
          }}
          onUpdate={fetchTeams}
        />
      )}
    </div>
  );
}

// Team Card Component
function TeamCard({ team, isAdmin, onEdit, onDelete, onViewMembers }) {
  const canManage = isAdmin; // TODO: Check if user created this team

  return (
    <div className="bg-wa-panel rounded-lg border border-wa-border p-6 hover:border-primary-500/50 transition">
      {/* Team Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
            <UserGroupIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{team.name}</h3>
            <p className="text-sm text-gray-400">
              {team.member_count || 0} member{team.member_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex space-x-1">
            <button
              onClick={onEdit}
              className="p-2 hover:bg-wa-hover rounded-lg transition text-gray-400 hover:text-white"
              title="Edit Team"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 hover:bg-wa-hover rounded-lg transition text-gray-400 hover:text-red-500"
              title="Delete Team"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      {team.description && (
        <p className="text-sm text-gray-400 mb-4 line-clamp-2">{team.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-wa-border">
        <div className="text-xs text-gray-500">
          Created {new Date(team.created_at).toLocaleDateString()}
        </div>
        <button
          onClick={onViewMembers}
          className="flex items-center space-x-1 text-sm text-primary-500 hover:text-primary-400 transition"
        >
          <UsersIcon className="w-4 h-4" />
          <span>View Members</span>
        </button>
      </div>
    </div>
  );
}

// Create Team Modal
function CreateTeamModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await teamAPI.createTeam(formData);
      toast.success('Team created successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-wa-panel rounded-lg p-6 w-full max-w-md border border-wa-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Create New Team</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-wa-hover rounded transition"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              minLength={2}
              maxLength={100}
              placeholder="e.g., Sales Team"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              maxLength={500}
              placeholder="Brief description of the team..."
            />
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white hover:bg-wa-hover transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Team Modal
function EditTeamModal({ team, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: team.name,
    description: team.description || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await teamAPI.updateTeam(team.id, formData);
      toast.success('Team updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update team');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-wa-panel rounded-lg p-6 w-full max-w-md border border-wa-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Edit Team</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-wa-hover rounded transition"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white hover:bg-wa-hover transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Team Members Modal
function TeamMembersModal({ team, isAdmin, onClose, onUpdate }) {
  const [members, setMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    fetchData();
  }, [team.id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [teamResponse, usersResponse] = await Promise.all([
        teamAPI.getTeamById(team.id),
        isAdmin ? userAPI.getUsers() : Promise.resolve({ data: [] })
      ]);

      setMembers(teamResponse.data.team_members || []);

      if (isAdmin) {
        // Filter out users who are already members
        const memberIds = new Set((teamResponse.data.team_members || []).map(m => m.user.id));
        const available = (usersResponse.data || []).filter(u => !memberIds.has(u.id) && u.is_active);
        setAvailableUsers(available);
      }
    } catch (error) {
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      await teamAPI.addMember(team.id, selectedUserId);
      toast.success('Member added successfully');
      setShowAddMember(false);
      setSelectedUserId('');
      fetchData();
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId, username) => {
    if (!confirm(`Remove ${username} from this team?`)) return;

    try {
      await teamAPI.removeMember(team.id, userId);
      toast.success('Member removed successfully');
      fetchData();
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-wa-panel rounded-lg p-6 w-full max-w-2xl border border-wa-border max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{team.name} - Members</h2>
            <p className="text-sm text-gray-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-wa-hover rounded transition"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Add Member Button */}
        {isAdmin && !showAddMember && availableUsers.length > 0 && (
          <button
            onClick={() => setShowAddMember(true)}
            className="mb-4 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-500/20 border border-primary-500/50 hover:bg-primary-500/30 rounded-lg text-primary-400 transition"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        )}

        {/* Add Member Form */}
        {showAddMember && (
          <div className="mb-4 p-4 bg-wa-bg border border-wa-border rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-3">Add Team Member</h3>
            <div className="flex space-x-2">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="flex-1 px-3 py-2 bg-wa-panel border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a user...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} {user.full_name ? `(${user.full_name})` : ''} - {user.role}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={!selectedUserId}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddMember(false);
                  setSelectedUserId('');
                }}
                className="px-4 py-2 bg-wa-panel border border-wa-border rounded-lg text-gray-400 hover:bg-wa-hover transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Members List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <UsersIcon className="w-12 h-12 mx-auto mb-2 text-gray-600" />
              <p>No members yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((membership) => (
                <div
                  key={membership.id}
                  className="flex items-center justify-between p-3 bg-wa-bg border border-wa-border rounded-lg hover:border-primary-500/50 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {membership.user.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{membership.user.username}</div>
                      <div className="text-xs text-gray-400">
                        {membership.user.full_name} • {membership.user.role?.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveMember(membership.user.id, membership.user.username)}
                      className="p-2 hover:bg-wa-hover rounded-lg transition text-gray-400 hover:text-red-500"
                      title="Remove member"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-4 pt-4 border-t border-wa-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-wa-bg border border-wa-border rounded-lg text-white hover:bg-wa-hover transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
