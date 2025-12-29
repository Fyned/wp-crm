/**
 * Session Connection Modal
 * Hybrid Auth: QR Code + Pairing Code
 */

import { useState, useEffect } from 'react';
import { sessionAPI } from '../../services/api';
import { useChatStore } from '../../stores/chatStore';
import toast from 'react-hot-toast';
import { QrCodeIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

export default function SessionModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' or 'pairing'
  const [step, setStep] = useState('create'); // 'create' or 'connect'
  const [sessionName, setSessionName] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { fetchSessions } = useChatStore();

  // Auto-refresh QR code
  useEffect(() => {
    if (activeTab === 'qr' && sessionId && step === 'connect') {
      loadQRCode();
      const interval = setInterval(loadQRCode, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [activeTab, sessionId, step]);

  const loadQRCode = async () => {
    try {
      const url = await sessionAPI.getQRCode(sessionId);
      setQrCodeUrl(url);
    } catch (error) {
      console.error('QR load error:', error);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await sessionAPI.createSession(sessionName);
      setSessionId(response.data.id);
      setStep('connect');
      toast.success('Session created! Now connect your WhatsApp.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPairingCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await sessionAPI.requestPairingCode(sessionId, phoneNumber);
      setPairingCode(response.data.code);
      toast.success('Pairing code generated! Enter it on your phone.');
    } catch (error) {
      toast.error('Failed to request pairing code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    fetchSessions();
    toast.success('Session setup complete!');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-wa-panel rounded-lg w-full max-w-lg border border-wa-border">
        {/* Header */}
        <div className="p-6 border-b border-wa-border">
          <h2 className="text-2xl font-bold text-white">
            {step === 'create' ? 'Create New Session' : 'Connect WhatsApp'}
          </h2>
          <p className="text-gray-400 mt-1">
            {step === 'create'
              ? 'Enter a unique name for this WhatsApp session'
              : 'Choose your preferred connection method'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'create' ? (
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., sales-team, support-line"
                  className="w-full px-4 py-3 bg-wa-bg border border-wa-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  pattern="[a-zA-Z0-9_-]+"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Only letters, numbers, underscores, and hyphens allowed
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-wa-bg border border-wa-border rounded-lg text-white hover:bg-wa-hover transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create & Connect'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex space-x-2 mb-6 bg-wa-bg rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('qr')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg transition ${
                    activeTab === 'qr'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <QrCodeIcon className="w-5 h-5" />
                  <span>QR Code</span>
                </button>
                <button
                  onClick={() => setActiveTab('pairing')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg transition ${
                    activeTab === 'pairing'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <DevicePhoneMobileIcon className="w-5 h-5" />
                  <span>Pairing Code</span>
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'qr' ? (
                <div className="text-center">
                  {qrCodeUrl ? (
                    <div>
                      <img
                        src={qrCodeUrl}
                        alt="QR Code"
                        className="w-64 h-64 mx-auto bg-white p-4 rounded-lg"
                      />
                      <p className="text-sm text-gray-400 mt-4">
                        Scan this QR code with WhatsApp on your phone
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Open WhatsApp → Settings → Linked Devices → Link a Device
                      </p>
                    </div>
                  ) : (
                    <div className="py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto" />
                      <p className="text-gray-400 mt-4">Loading QR code...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!pairingCode ? (
                    <form onSubmit={handleRequestPairingCode} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+1234567890"
                          className="w-full px-4 py-3 bg-wa-bg border border-wa-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Include country code (e.g., +1 for US)
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition disabled:opacity-50"
                      >
                        {isLoading ? 'Requesting...' : 'Request Pairing Code'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-center">
                      <div className="text-6xl font-bold text-primary-500 tracking-widest mb-4">
                        {pairingCode}
                      </div>
                      <p className="text-gray-400 mb-4">
                        Enter this code on your phone to link WhatsApp
                      </p>
                      <p className="text-sm text-gray-500">
                        Open WhatsApp → Settings → Linked Devices → Link a Device → Link
                        with Phone Number
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-wa-bg border border-wa-border rounded-lg text-white hover:bg-wa-hover transition"
                >
                  Close
                </button>
                <button
                  onClick={handleFinish}
                  className="flex-1 px-4 py-3 bg-primary-500 hover:bg-primary-600 rounded-lg text-white transition"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
