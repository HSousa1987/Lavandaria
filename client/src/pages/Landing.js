import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Landing = () => {
  const [activeTab, setActiveTab] = useState('client');
  const [formData, setFormData] = useState({ username: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.userType === 'client' && user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isClient = activeTab === 'client';
      const credentials = isClient
        ? { phone: formData.phone, password: formData.password }
        : { username: formData.username, password: formData.password };

      const response = await login(credentials, isClient);

      if (response.client && response.client.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white text-2xl font-bold">L</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Lavandaria</h1>
                <p className="text-sm text-gray-600">Laundry & Airbnb Cleaning Services</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Info */}
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              Professional Cleaning Services You Can Trust
            </h2>
            <p className="text-xl text-gray-600">
              Premium laundry services and Airbnb property cleaning with real-time tracking and photo verification.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-6">
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Laundry Service</h3>
                <p className="text-sm text-gray-600">Professional clothing care</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Airbnb Cleaning</h3>
                <p className="text-sm text-gray-600">Photo-verified deep cleaning</p>
              </div>
            </div>
          </div>

          {/* Right Column - Login Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('client')}
                className={`flex-1 py-3 text-center font-medium transition-colors ${
                  activeTab === 'client'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Client Login
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-3 text-center font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Staff Login
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {activeTab === 'client' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Enter your username"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {activeTab === 'client' && (
              <p className="mt-4 text-sm text-gray-600 text-center">
                First time logging in? Your default password is: <code className="bg-gray-100 px-2 py-1 rounded">lavandaria2025</code>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">&copy; 2025 Lavandaria. Professional Cleaning Services.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
