import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LaundryOrderForm = ({ onSuccess, onCancel, editOrder = null, clients = [] }) => {
  const [formData, setFormData] = useState({
    client_id: editOrder?.client_id || '',
    order_type: editOrder?.order_type || 'bulk_kg',
    services: editOrder?.services || [], // Array of service IDs
    weight_kg: editOrder?.weight_kg || '',
    pickup_date: editOrder?.pickup_date || '',
    status: editOrder?.status || 'received'
  });
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch available services on mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await axios.get('/api/laundry-services');
        if (response.data.success) {
          setServices(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
      }
    };
    fetchServices();
  }, []);

  // Calculate total price based on selected services and weight
  const calculateTotal = () => {
    if (formData.order_type === 'bulk_kg' && formData.weight_kg) {
      // Sum of all service prices * weight
      const total = services
        .filter(s => formData.services.includes(s.id))
        .reduce((sum, s) => sum + (parseFloat(s.base_price) * parseFloat(formData.weight_kg)), 0);
      return total.toFixed(2);
    } else {
      // Sum of individual service prices
      const total = services
        .filter(s => formData.services.includes(s.id))
        .reduce((sum, s) => sum + parseFloat(s.base_price), 0);
      return total.toFixed(2);
    }
  };

  const handleServiceToggle = (serviceId) => {
    setFormData({
      ...formData,
      services: formData.services.includes(serviceId)
        ? formData.services.filter(id => id !== serviceId)
        : [...formData.services, serviceId]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = editOrder
        ? `/api/laundry-orders/${editOrder.id}`
        : '/api/laundry-orders';
      const method = editOrder ? 'put' : 'post';

      const response = await axios[method](endpoint, formData);

      if (response.data.success) {
        console.log(`✅ Order ${editOrder ? 'updated' : 'created'} with correlation ID:`, response.data._meta.correlationId);
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
        <label className="block text-sm font-medium text-gray-700">Order Type *</label>
        <select
          value={formData.order_type}
          onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="bulk_kg">Bulk (by weight)</option>
          <option value="itemized">Itemized</option>
        </select>
      </div>

      {formData.order_type === 'bulk_kg' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Weight (kg) *</label>
          <input
            type="number"
            step="0.1"
            value={formData.weight_kg}
            onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
            required={formData.order_type === 'bulk_kg'}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Services *</label>
        <div className="mt-2 space-y-2 border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
          {services.length === 0 ? (
            <p className="text-gray-500">No services available</p>
          ) : (
            services.map((service) => (
              <label key={service.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.services.includes(service.id)}
                  onChange={() => handleServiceToggle(service.id)}
                  className="rounded"
                />
                <span className="text-sm">
                  {service.name} - €{service.base_price} per {service.unit}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Pickup Date *</label>
        <input
          type="date"
          value={formData.pickup_date}
          onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      {editOrder && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="received">Received</option>
            <option value="in_progress">In Progress</option>
            <option value="ready">Ready</option>
            <option value="collected">Collected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-md">
        <p className="text-sm font-medium text-gray-700">
          Estimated Total: €{calculateTotal()}
        </p>
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
          disabled={loading || formData.services.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Saving...' : editOrder ? 'Update Order' : 'Create Order'}
        </button>
      </div>
    </form>
  );
};

export default LaundryOrderForm;
