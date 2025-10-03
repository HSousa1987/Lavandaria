import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Stats state
  const [stats, setStats] = useState({
    totalClients: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });

  // Clients state
  const [clients, setClients] = useState([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  // Orders state
  const [orders, setOrders] = useState([]);

  // Payments state
  const [payments, setPayments] = useState([]);

  // Settings state (Master only)
  const [settings, setSettings] = useState({
    vat_rate: 20,
    delivery_fee: 5,
    cleaning_rate_per_hour: 15
  });

  // Services state (Master/Admin)
  const [services, setServices] = useState([]);
  const [editingService, setEditingService] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    if (user?.role === 'master') {
      fetchSettings();
    }
    if (user?.role === 'master' || user?.role === 'admin') {
      fetchServices();
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch stats
      const statsResponse = await axios.get('/api/admin/stats');
      setStats(statsResponse.data);

      // Fetch clients
      const clientsResponse = await axios.get('/api/admin/clients');
      setClients(clientsResponse.data);

      // Fetch orders
      const ordersResponse = await axios.get('/api/admin/orders');
      setOrders(ordersResponse.data);

      // Fetch payments
      const paymentsResponse = await axios.get('/api/admin/payments');
      setPayments(paymentsResponse.data);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await axios.put(`/api/admin/clients/${editingClient.id}`, clientForm);
      } else {
        await axios.post('/api/admin/clients', clientForm);
      }
      setShowClientForm(false);
      setEditingClient(null);
      setClientForm({ name: '', email: '', phone: '', address: '' });
      fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save client');
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address
    });
    setShowClientForm(true);
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;

    try {
      await axios.delete(`/api/admin/clients/${clientId}`);
      fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete client');
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`/api/admin/orders/${orderId}/status`, { status });
      fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order status');
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      if (response.data && response.data.length > 0) {
        const settingsObj = {};
        response.data.forEach(setting => {
          // Map database keys to frontend keys
          const key = setting.setting_key;
          const value = parseFloat(setting.setting_value);

          if (key === 'vat_rate') settingsObj.vat_rate = value;
          if (key === 'delivery_fee') settingsObj.delivery_fee = value;
          if (key === 'cleaning_rate_30min') settingsObj.cleaning_rate_per_hour = value;
        });
        setSettings(settingsObj);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await axios.get('/api/laundry-services');
      setServices(response.data);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      setError('');

      // Update each setting individually
      await axios.put('/api/settings/vat_rate', {
        setting_value: settings.vat_rate.toString()
      });
      await axios.put('/api/settings/delivery_fee', {
        setting_value: settings.delivery_fee.toString()
      });
      await axios.put('/api/settings/cleaning_rate_30min', {
        setting_value: settings.cleaning_rate_per_hour.toString()
      });

      alert('Settings updated successfully!');
      fetchSettings(); // Refresh settings
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update settings');
    }
  };

  const handleUpdateService = async (serviceId, price) => {
    try {
      await axios.put(`/api/laundry-services/${serviceId}`, { base_price: parseFloat(price) });
      fetchServices();
      setEditingService(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update service price');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Welcome, {user?.name || 'Admin'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['overview', 'clients', 'orders', 'payments',
              ...(user?.role === 'master' || user?.role === 'admin' ? ['services'] : []),
              ...(user?.role === 'master' ? ['settings'] : [])
            ].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500">Total Clients</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalClients}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500">Total Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <p className="text-sm font-medium text-gray-500">Pending Orders</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.pendingOrders}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.slice(0, 5).map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.clientName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{order.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.amount?.toFixed(2) || '0.00'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Client Management</h2>
              <button
                onClick={() => {
                  setShowClientForm(true);
                  setEditingClient(null);
                  setClientForm({ name: '', email: '', phone: '', address: '' });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add New Client
              </button>
            </div>

            {/* Client Form */}
            {showClientForm && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingClient ? 'Edit Client' : 'New Client'}
                </h3>
                <form onSubmit={handleClientSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={clientForm.name}
                        onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={clientForm.email}
                        onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={clientForm.phone}
                        onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={clientForm.address}
                        onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingClient ? 'Update Client' : 'Create Client'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowClientForm(false);
                        setEditingClient(null);
                        setClientForm({ name: '', email: '', phone: '', address: '' });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Clients List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.address}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditClient(client)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">All Orders</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{order.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.clientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{order.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className={`px-2 py-1 text-xs leading-5 font-semibold rounded-full border-0 ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${order.amount?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payments & Finance</h2>

            {/* Payment Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Total Paid</p>
                <p className="text-2xl font-semibold text-green-600 mt-2">
                  ${payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Pending Payments</p>
                <p className="text-2xl font-semibold text-yellow-600 mt-2">
                  ${payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-semibold text-red-600 mt-2">
                  ${payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Payments Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{payment.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.clientName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{payment.orderId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.amount?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Services Tab (Master/Admin) */}
        {activeTab === 'services' && (user?.role === 'master' || user?.role === 'admin') && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Laundry Service Pricing</h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price per Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{service.service_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingService === service.id ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={service.base_price}
                            className="w-24 px-2 py-1 border border-gray-300 rounded"
                            id={`price-${service.id}`}
                          />
                        ) : (
                          `€${parseFloat(service.base_price).toFixed(2)}`
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.unit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingService === service.id ? (
                          <>
                            <button
                              onClick={() => {
                                const newPrice = document.getElementById(`price-${service.id}`).value;
                                handleUpdateService(service.id, newPrice);
                              }}
                              className="text-green-600 hover:text-green-900 mr-3"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingService(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingService(service.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit Price
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab (Master only) */}
        {activeTab === 'settings' && user?.role === 'master' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h2>
            <div className="bg-white rounded-lg shadow p-6">
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VAT Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.vat_rate || 0}
                      onChange={(e) => setSettings({ ...settings, vat_rate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Applied to all orders</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Fee (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.delivery_fee || 0}
                      onChange={(e) => setSettings({ ...settings, delivery_fee: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">For laundry orders with delivery</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cleaning Rate (€/hour)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.cleaning_rate_per_hour || 0}
                      onChange={(e) => setSettings({ ...settings, cleaning_rate_per_hour: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">Hourly rate for Airbnb cleaning</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">Current Settings:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• VAT Rate: {settings.vat_rate}%</li>
                    <li>• Delivery Fee: €{settings.delivery_fee?.toFixed(2)}</li>
                    <li>• Cleaning Rate: €{settings.cleaning_rate_per_hour?.toFixed(2)}/hour</li>
                  </ul>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
