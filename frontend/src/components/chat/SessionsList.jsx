/**
 * Sessions List Component - Left Column
 * Shows all WhatsApp sessions (phone numbers) with metadata
 */

import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import {
  PlusIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  PhoneIcon,
  SignalIcon,
  SignalSlashIcon,
  PencilIcon,
  TagIcon,
  UserGroupIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SessionAssignmentModal from '../modals/SessionAssignmentModal';
import { sessionAPI } from '../../services/api';

export default function SessionsList({ onNewSession, isAdmin }) {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { sessions, currentSession, setCurrentSession } = useChatStore();
  const [editingSession, setEditingSession] = useState(null);
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [sessionToAssign, setSessionToAssign] = useState(null);
  const [assignmentsMap, setAssignmentsMap] = useState({});

  const handleSessionSelect = async (session) => {
    await setCurrentSession(session);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenAssignModal = (session, e) => {
    e.stopPropagation();
    setSessionToAssign(session);
    setShowAssignModal(true);
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSessionToAssign(null);
  };

  const loadAssignments = async () => {
    try {
      const assignmentsData = {};
      for (const session of sessions) {
        const response = await sessionAPI.getSessionAssignments(session.id);
        assignmentsData[session.id] = response.data || [];
      }
      setAssignmentsMap(assignmentsData);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  };

  const handleAssignmentUpdate = () => {
    loadAssignments(); // Reload assignments after update
  };

  // Load assignments when sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      loadAssignments();
    }
  }, [sessions]);

  const handleEditMetadata = (session, e) => {
    e.stopPropagation();
    setEditingSession(session.id);
    setCustomName(session.custom_label || '');
    setNotes(session.notes || '');
  };

  const handleSaveMetadata = async (sessionId) => {
    try {
      // TODO: API call to save session metadata
      toast.success('Session metadata saved');
      setEditingSession(null);
    } catch (error) {
      toast.error('Failed to save metadata');
    }
  };

  return (
    <div className="w-64 bg-wa-panel flex flex-col border-r border-wa-border">
      {/* Header */}
      <div className="bg-wa-panel p-4 border-b border-wa-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm">{user?.username}</h2>
              <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex space-x-1">
            <button
              onClick={() => navigate('/teams')}
              className="p-1.5 hover:bg-wa-hover rounded-full transition"
              title="Teams"
            >
              <UserGroupIcon className="w-5 h-5 text-gray-400" />
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="p-1.5 hover:bg-wa-hover rounded-full transition"
                title="Admin Panel"
              >
                <Cog6ToothIcon className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-wa-hover rounded-full transition"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Sessions</h3>
          {isAdmin && (
            <button
              onClick={onNewSession}
              className="p-1.5 hover:bg-wa-hover rounded-full transition"
              title="New Session"
            >
              <PlusIcon className="w-5 h-5 text-primary-400" />
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <PhoneIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-sm">No sessions yet</p>
            {isAdmin && (
              <button
                onClick={onNewSession}
                className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 transition"
              >
                Add Session
              </button>
            )}
          </div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={currentSession?.id === session.id}
              onClick={() => handleSessionSelect(session)}
              onEdit={handleEditMetadata}
              onAssign={handleOpenAssignModal}
              isAdmin={isAdmin}
              isEditing={editingSession === session.id}
              customName={customName}
              setCustomName={setCustomName}
              notes={notes}
              setNotes={setNotes}
              onSave={() => handleSaveMetadata(session.id)}
              onCancel={() => setEditingSession(null)}
              assignments={assignmentsMap[session.id] || []}
            />
          ))
        )}
      </div>

      {/* Session Assignment Modal */}
      {showAssignModal && sessionToAssign && (
        <SessionAssignmentModal
          session={sessionToAssign}
          onClose={handleCloseAssignModal}
          onUpdate={handleAssignmentUpdate}
        />
      )}
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onClick,
  onEdit,
  onAssign,
  isAdmin,
  isEditing,
  customName,
  setCustomName,
  notes,
  setNotes,
  onSave,
  onCancel,
  assignments
}) {
  const isConnected = session.status === 'CONNECTED';
  const displayName = session.custom_label || session.phone_number || session.session_name;

  if (isEditing) {
    return (
      <div className="p-3 border-b border-wa-border bg-wa-bg">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Custom name"
          className="w-full px-2 py-1 mb-2 bg-wa-panel border border-wa-border rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          rows={2}
          className="w-full px-2 py-1 mb-2 bg-wa-panel border border-wa-border rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div className="flex space-x-2">
          <button
            onClick={onSave}
            className="flex-1 px-2 py-1 bg-primary-500 text-white rounded text-xs hover:bg-primary-600"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-2 py-1 bg-wa-panel border border-wa-border text-gray-300 rounded text-xs hover:bg-wa-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`p-3 cursor-pointer border-b border-wa-border hover:bg-wa-hover transition group ${
        isActive ? 'bg-wa-hover border-l-4 border-l-primary-500' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Phone Number / Name */}
          <div className="flex items-center space-x-2 mb-1">
            {isConnected ? (
              <SignalIcon className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            ) : (
              <SignalSlashIcon className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            )}
            <h3 className="font-semibold text-white text-sm truncate">
              {displayName}
            </h3>
          </div>

          {/* Status */}
          <div className="flex items-center space-x-2">
            <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {session.status}
            </span>
          </div>

          {/* Notes Preview */}
          {session.notes && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              {session.notes}
            </p>
          )}

          {/* Tags */}
          {session.tags && session.tags.length > 0 && (
            <div className="flex items-center space-x-1 mt-1">
              <TagIcon className="w-3 h-3 text-gray-500" />
              {session.tags.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="text-xs text-gray-500">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Assignments */}
          {assignments && assignments.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mt-2">
              {assignments.map((assignment) => (
                <span
                  key={assignment.id}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 bg-primary-500/20 border border-primary-500/30 rounded text-xs text-primary-300"
                >
                  {assignment.assigned_to_team_id ? (
                    <>
                      <UserGroupIcon className="w-3 h-3" />
                      <span>{assignment.assigned_team?.name}</span>
                    </>
                  ) : (
                    <>
                      <UserIcon className="w-3 h-3" />
                      <span>{assignment.assigned_user?.username}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isAdmin && (
          <div className="flex flex-col space-y-1">
            <button
              onClick={(e) => onAssign(session, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-wa-panel rounded transition"
              title="Assign session"
            >
              <UserGroupIcon className="w-4 h-4 text-primary-400" />
            </button>
            <button
              onClick={(e) => onEdit(session, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-wa-panel rounded transition"
              title="Edit metadata"
            >
              <PencilIcon className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
