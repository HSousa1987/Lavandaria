import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ChangePassword = () => {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [validationErrors, setValidationErrors] = useState({});

  const validateForm = () => {
    const errors = {};

    // Current password validation
    if (!formData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    // New password validation
    if (!formData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters long';
    } else if (formData.newPassword === formData.currentPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate form
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      await changePassword(formData.currentPassword, formData.newPassword);

      setSuccess('Password changed successfully! Redirecting...');

      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please check your current password and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Change Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Update your password to keep your account secure
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{success}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.currentPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your current password"
                disabled={loading}
              />
              {validationErrors.currentPassword && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.newPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your new password"
                disabled={loading}
              />
              {validationErrors.newPassword && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.newPassword}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Confirm your new password"
                disabled={loading}
              />
              {validationErrors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
              )}
            </div>

            {/* Password Strength Indicator */}
            {formData.newPassword && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password Strength</span>
                  <span className={`text-xs font-medium ${
                    formData.newPassword.length >= 12 ? 'text-green-600' :
                    formData.newPassword.length >= 8 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {formData.newPassword.length >= 12 ? 'Strong' :
                     formData.newPassword.length >= 8 ? 'Medium' :
                     'Weak'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      formData.newPassword.length >= 12 ? 'bg-green-600 w-full' :
                      formData.newPassword.length >= 8 ? 'bg-yellow-600 w-2/3' :
                      'bg-red-600 w-1/3'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Changing...
                  </span>
                ) : (
                  'Change Password'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-2">Password Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Use at least 8 characters (12+ recommended)</li>
                <li>Include a mix of letters, numbers, and symbols</li>
                <li>Avoid common words or personal information</li>
                <li>Don't reuse passwords from other accounts</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-4">
          <button
            onClick={handleCancel}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
