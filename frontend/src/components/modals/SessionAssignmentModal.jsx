/**
 * Session Assignment Modal
 * Assign sessions to users or teams
 */

import { useState, useEffect } from 'react';
import { sessionAPI, teamAPI, userAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { XMarkIcon, UserIcon, UserGroupIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function SessionAssignmentModal({ session, onClose, onUpdate }) {
  const [assignments, setAssignments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assignMode, setAssignMode] = useState('team'); // 'team' or 'user'
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    loadData();
  }, [session.id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [assignmentsRes, teamsRes, usersRes] = await Promise.all([
        sessionAPI.getSessionAssignments(session.id),
        teamAPI.getTeams(),
        userAPI.getUsers()
      ]);

      setAssignments(assignmentsRes.data || []);
      setTeams(teamsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      toast.error('Failed to load assignment data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (assignMode === 'team' && !selectedTeamId) {
      toast.error('Please select a team');
      return;
    }
    if (assignMode === 'user' && !selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setIsAssigning(true);
    try {
      await sessionAPI.assignSession(session.id, {
        assigned_to_team_id: assignMode === 'team' ? selectedTeamId : null,
        assigned_to_user_id: assignMode === 'user' ? selectedUserId : null
      });

      toast.success(`Session assigned to ${assignMode === 'team' ? 'team' : 'user'} successfully`);
      setSelectedTeamId('');
      setSelectedUserId('');
      loadData();
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign session');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (assignmentId, name) => {
    if (!confirm(`Remove assignment to ${name}?`)) return;

    try {
      await sessionAPI.unassignSession(session.id, assignmentId);
      toast.success('Assignment removed successfully');
      loadData();
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove assignment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-wa-panel rounded-lg p-6 w-full max-w-2xl border border-wa-border max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Session Assignments</h2>
            <p className="text-sm text-gray-400">{session.session_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-wa-hover rounded transition"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Current Assignments */}
        {!isLoading && assignments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-3">Current Assignments</h3>
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 bg-wa-bg border border-wa-border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {assignment.assigned_to_team_id ? (
                      <>
                        <UserGroupIcon className="w-5 h-5 text-primary-400" />
                        <div>
                          <div className="text-sm font-medium text-white">
                            Team: {assignment.assigned_team?.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <UserIcon className="w-5 h-5 text-primary-400" />
                        <div>
                          <div className="text-sm font-medium text-white">
                            User: {assignment.assigned_user?.username}
                          </div>
                          <div className="text-xs text-gray-400">
                            Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      handleUnassign(
                        assignment.id,
                        assignment.assigned_team?.name || assignment.assigned_user?.username
                      )
                    }
                    className="p-2 hover:bg-wa-hover rounded-lg transition text-gray-400 hover:text-red-500"
                    title="Remove assignment"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign New */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Assign To</h3>

          {/* Toggle: Team or User */}
          <div className="flex space-x-2 mb-4 bg-wa-bg rounded-lg p-1">
            <button
              onClick={() => setAssignMode('team')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition ${
                assignMode === 'team'
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserGroupIcon className="w-4 h-4" />
              <span>Team</span>
            </button>
            <button
              onClick={() => setAssignMode('user')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition ${
                assignMode === 'user'
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>User</span>
            </button>
          </div>

          {/* Selection */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : (
            <div className="flex space-x-2">
              {assignMode === 'team' ? (
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.member_count || 0} members)
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-wa-bg border border-wa-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a user...</option>
                  {users
                    .filter((u) => u.is_active)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} {user.full_name ? `(${user.full_name})` : ''} -{' '}
                        {user.role?.replace('_', ' ')}
                      </option>
                    ))}
                </select>
              )}

              <button
                onClick={handleAssign}
                disabled={isAssigning}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50"
              >
                {isAssigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mb-4 p-3 bg-wa-bg/50 border border-wa-border rounded-lg">
          <p className="text-xs text-gray-400">
            <strong>Note:</strong> Assigned users/teams will have access to this session's
            chats and messages. Team members will inherit access from their team membership.
          </p>
        </div>

        {/* Close Button */}
        <div className="mt-auto pt-4 border-t border-wa-border">
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
