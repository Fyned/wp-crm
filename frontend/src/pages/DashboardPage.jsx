/**
 * Dashboard Page
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-wa-bg">
      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashboardCard
            title="Messages"
            value="0"
            subtitle="Total messages sent"
            color="bg-blue-500"
          />
          <DashboardCard
            title="Sessions"
            value="0"
            subtitle="Active WhatsApp sessions"
            color="bg-green-500"
          />
          <DashboardCard
            title="Users"
            value="0"
            subtitle="Team members"
            color="bg-purple-500"
          />
        </div>

        <div className="mt-8">
          <button
            onClick={() => navigate('/chat')}
            className="bg-primary-500 hover:bg-primary-600 px-6 py-3 rounded-lg text-white transition"
          >
            Go to Chat
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, subtitle, color }) {
  return (
    <div className="bg-wa-panel border border-wa-border rounded-lg p-6">
      <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center mb-4`}>
        <span className="text-2xl text-white">📊</span>
      </div>
      <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
      <p className="text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}
