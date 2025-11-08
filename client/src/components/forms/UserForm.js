import React, { useState } from 'react';
import axios from 'axios';

const UserForm = ({ onSuccess, onCancel, editUser = null }) => {
  const [formData, setFormData] = useState({
    username: editUser?.username || '',
    password: editUser ? '' : '', // Don't pre-fill password on edit
    role: editUser?.role || 'worker',
    phone: editUser?.phone || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editUser
        ? `/api/users/${editUser.id}`
        : '/api/users';
      const method = editUser ? 'put' : 'post';

      const response = await axios[method](endpoint, formData);

      if (response.data.success) {
        console.log(`✅ User ${editUser ? 'updated' : 'created'} with correlation ID:`, response.data._meta.correlationId);
        onSuccess(response.data.data);
      }
    } catch (err) {
      const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
      setError(`Error: ${err.response?.data?.error || err.message} (${correlationId})`);
      console.error('❌ User form error:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Username *</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={!!editUser} // Can't change username on edit
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Password {editUser ? '(leave blank to keep current)' : '*'}
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required={!editUser}
          minLength={8}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Role *</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="admin">Admin</option>
          <option value="worker">Worker</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone *</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
          pattern="[0-9]{9}"
          placeholder="912345678"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">9 digits, Portuguese format</p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
