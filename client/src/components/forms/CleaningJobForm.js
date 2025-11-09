import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CleaningJobForm = ({ onSuccess, onCancel, editJob = null, clients = [], workers = [] }) => {
  // Helper: Convert ISO date to yyyy-MM-dd format
  const formatDateForInput = (isoDate) => {
    if (!isoDate) return '';
    try {
      const date = new Date(isoDate);
      return date.toISOString().split('T')[0]; // "2025-11-11"
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    client_id: editJob?.client_id || '',
    job_type: editJob?.job_type || 'house',
    address: editJob?.address || '',
    scheduled_date: formatDateForInput(editJob?.scheduled_date) || '',
    scheduled_time: editJob?.scheduled_time || '',
    assigned_worker_id: editJob?.assigned_worker_id || '',
    status: editJob?.status || 'scheduled'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editJob
        ? `/api/cleaning-jobs/${editJob.id}`
        : '/api/cleaning-jobs';
      const method = editJob ? 'put' : 'post';

      // Convert empty strings to null for optional fields
      const payload = {
        ...formData,
        assigned_worker_id: formData.assigned_worker_id || null
      };

      const response = await axios[method](endpoint, payload);

      if (response.data.success) {
        console.log(`✅ Job ${editJob ? 'updated' : 'created'} with correlation ID:`, response.data._meta.correlationId);
        onSuccess(response.data.data);
      }
    } catch (err) {
      const correlationId = err.response?.data?._meta?.correlationId || 'unknown';
      setError(`Error: ${err.response?.data?.error || err.message} (${correlationId})`);
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
        <label className="block text-sm font-medium text-gray-700">Client *</label>
        <select
          value={formData.client_id}
          onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Select a client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Job Type *</label>
        <select
          value={formData.job_type}
          onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="house">House Cleaning</option>
          <option value="airbnb">Airbnb Cleaning</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address *</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          required
          rows={2}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date *</label>
          <input
            type="date"
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Time *</label>
          <input
            type="time"
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Assigned Worker</label>
        <select
          value={formData.assigned_worker_id}
          onChange={(e) => setFormData({ ...formData, assigned_worker_id: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">None (Unassigned)</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.username}
            </option>
          ))}
        </select>
      </div>

      {editJob && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}

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
          {loading ? 'Saving...' : editJob ? 'Update Job' : 'Create Job'}
        </button>
      </div>
    </form>
  );
};

export default CleaningJobForm;
