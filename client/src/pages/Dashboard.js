import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
  const { user, logout, isMaster, isAdmin, isWorker, isClient } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // State
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [airbnbOrders, setAirbnbOrders] = useState([]);
  const [laundryOrders, setLaundryOrders] = useState([]);
  const [cleaningJobs, setCleaningJobs] = useState([]);
  const [laundryOrdersNew, setLaundryOrdersNew] = useState([]);

  // Form states
  const [showUserForm, setShowUserForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showCleaningJobForm, setShowCleaningJobForm] = useState(false);
  const [showLaundryOrderForm, setShowLaundryOrderForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editingCleaningJob, setEditingCleaningJob] = useState(null);
  const [editingLaundryOrder, setEditingLaundryOrder] = useState(null);

  // Order detail modal states
  const [viewingOrderDetail, setViewingOrderDetail] = useState(null);
  const [orderDetailData, setOrderDetailData] = useState(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'worker',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    nif: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    district: '',
    country: 'Portugal',
    is_active: true
  });

  // Function to sanitize username (remove accents and special characters)
  const sanitizeUsername = (text) => {
    if (!text) return '';

    // Normalize to remove accents (NFD = Normalization Form Canonical Decomposition)
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Remove special characters, keep only letters, numbers, dots and underscores
    // Convert to lowercase
    return normalized
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
      .replace(/\s+/g, ''); // Remove any remaining spaces
  };

  // Auto-generate username from first and last name
  const generateUsername = (firstName, lastName) => {
    if (!firstName && !lastName) return '';

    const sanitizedFirst = sanitizeUsername(firstName);
    const sanitizedLast = sanitizeUsername(lastName);

    if (sanitizedFirst && sanitizedLast) {
      return `${sanitizedFirst}.${sanitizedLast}`;
    } else if (sanitizedFirst) {
      return sanitizedFirst;
    } else if (sanitizedLast) {
      return sanitizedLast;
    }
    return '';
  };
  const [clientForm, setClientForm] = useState({
    phone: '',
    first_name: '',
    last_name: '',
    email: '',
    date_of_birth: '',
    nif: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    district: '',
    country: 'Portugal',
    notes: '',
    is_enterprise: false,
    company_name: '',
    is_active: true
  });
  const [cleaningJobForm, setCleaningJobForm] = useState({
    client_id: '',
    job_type: 'airbnb',
    property_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    district: '',
    country: 'Portugal',
    scheduled_date: '',
    scheduled_time: '',
    assigned_worker_ids: [], // Changed to array for multiple workers
    estimated_hours: '',
    hourly_rate: 15.00,
    special_instructions: '',
    notes: ''
  });
  const [laundryOrderForm, setLaundryOrderForm] = useState({
    client_id: '',
    order_type: 'bulk_kg',
    total_weight_kg: '',
    price_per_kg: 3.50,
    expected_ready_date: '',
    assigned_worker_id: '',
    special_instructions: '',
    items: [],
    service_id: '',
    delivery_requested: false
  });
  const [laundryItem, setLaundryItem] = useState({
    item_type: '',
    item_category: 'clothing',
    quantity: 1,
    unit_price: 3.50,
    special_treatment: ''
  });
  const [laundryServices, setLaundryServices] = useState([]);

  useEffect(() => {
    fetchData();
    // Fetch laundry services for pricing
    if (isMaster || isAdmin) {
      fetchLaundryServices();
    }
  }, []);

  const fetchLaundryServices = async () => {
    try {
      const response = await axios.get('/api/laundry-services');
      setLaundryServices(response.data);
    } catch (err) {
      console.error('Failed to fetch laundry services:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch based on role
      if (isMaster || isAdmin) {
        // Fetch stats
        const statsRes = await axios.get('/api/dashboard/stats');
        setStats(statsRes.data);

        // Fetch clients
        console.log('🔵🔵🔵 FRONTEND: Fetching clients from /api/clients');
        const clientsRes = await axios.get('/api/clients');
        console.log('✅ FRONTEND: Clients fetched successfully');
        console.log('✅ Number of clients:', clientsRes.data.length);
        console.log('✅ Clients data sample:', clientsRes.data[0]);
        setClients(clientsRes.data);

        // Fetch orders
        const airbnbRes = await axios.get('/api/cleaning-jobs');
        console.log('🔵 [DASHBOARD] Loaded cleaning jobs from NEW endpoint:', airbnbRes.data._meta || airbnbRes.data.length);
        setAirbnbOrders(airbnbRes.data.data || airbnbRes.data);

        const laundryRes = await axios.get('/api/laundry-orders');
        console.log('🔵 [DASHBOARD] Loaded laundry orders from NEW endpoint:', laundryRes.data.length);
        setLaundryOrders(laundryRes.data);

        // Fetch new jobs system
        const cleaningJobsRes = await axios.get('/api/cleaning-jobs');
        setCleaningJobs(cleaningJobsRes.data);

        const laundryOrdersRes = await axios.get('/api/laundry-orders');
        setLaundryOrdersNew(laundryOrdersRes.data);

        if (isMaster) {
          // Master can see all users
          const usersRes = await axios.get('/api/users');
          setUsers(usersRes.data);
        } else {
          // Admin can only see workers
          const usersRes = await axios.get('/api/users');
          setWorkers(usersRes.data.filter(u => u.role === 'worker'));
        }
      } else if (isWorker) {
        // Workers only see their assigned jobs
        const airbnbRes = await axios.get('/api/cleaning-jobs');
        console.log('🔵 [DASHBOARD-WORKER] Loaded cleaning jobs from NEW endpoint:', airbnbRes.data._meta || airbnbRes.data.length);
        setAirbnbOrders(airbnbRes.data.data || airbnbRes.data);

        // Get clients list for contact info
        const clientsRes = await axios.get('/api/clients');
        setClients(clientsRes.data);

        // Fetch new jobs system
        const cleaningJobsRes = await axios.get('/api/cleaning-jobs');
        setCleaningJobs(cleaningJobsRes.data);

        const laundryOrdersRes = await axios.get('/api/laundry-orders');
        setLaundryOrdersNew(laundryOrdersRes.data);
      } else if (isClient) {
        // Clients see their own orders
        const airbnbRes = await axios.get('/api/cleaning-jobs');
        console.log('🔵 [DASHBOARD] Loaded cleaning jobs from NEW endpoint:', airbnbRes.data._meta || airbnbRes.data.length);
        setAirbnbOrders(airbnbRes.data.data || airbnbRes.data);

        const laundryRes = await axios.get('/api/laundry-orders');
        console.log('🔵 [DASHBOARD] Loaded laundry orders from NEW endpoint:', laundryRes.data.length);
        setLaundryOrders(laundryRes.data);

        // Fetch new jobs system
        const cleaningJobsRes = await axios.get('/api/cleaning-jobs');
        setCleaningJobs(cleaningJobsRes.data);

        const laundryOrdersRes = await axios.get('/api/laundry-orders');
        setLaundryOrdersNew(laundryOrdersRes.data);
      }
    } catch (err) {
      console.error('❌❌❌ FRONTEND ERROR IN fetchData!');
      console.error('❌ Error:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error response:', err.response);
      console.error('❌ Error response data:', err.response?.data);
      console.error('❌ Error response status:', err.response?.status);
      setError(err.response?.data?.error || 'Failed to load data');
      console.error('Data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`/api/users/${editingUser.id}`, userForm);
        setSuccess('User updated successfully');
      } else {
        await axios.post('/api/users', userForm);
        setSuccess('User created successfully');
      }
      setShowUserForm(false);
      setEditingUser(null);
      setUserForm({
        username: '', password: '', role: 'worker', first_name: '', last_name: '',
        email: '', phone: '', date_of_birth: '', nif: '',
        address_line1: '', address_line2: '', city: '', postal_code: '', district: '', country: 'Portugal',
        is_active: true
      });
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    }
  };

  // Helper function to format date for input[type="date"]
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // If already in yyyy-MM-dd format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
    // Otherwise, parse and format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      username: user.username || '',
      password: '', // Don't show password
      role: user.role,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      date_of_birth: formatDateForInput(user.date_of_birth),
      nif: user.nif || '',
      address_line1: user.address_line1 || '',
      address_line2: user.address_line2 || '',
      city: user.city || '',
      postal_code: user.postal_code || '',
      district: user.district || '',
      country: user.country || 'Portugal',
      is_active: user.is_active !== undefined ? user.is_active : true
    });
    setShowUserForm(true);
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();

    console.log('🟢🟢🟢 ==========================================');
    console.log('🟢 FRONTEND: handleCreateClient called');
    console.log('🟢🟢🟢 ==========================================');
    console.log('📤 CLIENT FORM DATA TO SEND:');
    console.log('   phone:', clientForm.phone);
    console.log('   first_name:', clientForm.first_name);
    console.log('   last_name:', clientForm.last_name);
    console.log('   email:', clientForm.email);
    console.log('   date_of_birth:', clientForm.date_of_birth);
    console.log('   nif:', clientForm.nif);
    console.log('   address_line1:', clientForm.address_line1);
    console.log('   address_line2:', clientForm.address_line2);
    console.log('   city:', clientForm.city);
    console.log('   postal_code:', clientForm.postal_code);
    console.log('   district:', clientForm.district);
    console.log('   country:', clientForm.country);
    console.log('   notes:', clientForm.notes);
    console.log('   is_enterprise:', clientForm.is_enterprise);
    console.log('   company_name:', clientForm.company_name);
    console.log('   is_active:', clientForm.is_active);
    console.log('🟢 ==========================================');

    try {
      if (editingClient) {
        console.log('📝 UPDATING existing client ID:', editingClient.id);
        const response = await axios.put(`/api/clients/${editingClient.id}`, clientForm);
        console.log('✅ UPDATE Response:', response.data);
        setSuccess('Client updated successfully');
      } else {
        console.log('➕ CREATING new client');
        console.log('📡 Sending POST to /api/clients');
        const response = await axios.post('/api/clients', clientForm);
        console.log('✅✅✅ CREATE SUCCESSFUL!');
        console.log('✅ Response status:', response.status);
        console.log('✅ Response data:', response.data);
        setSuccess('Client created successfully');
      }

      console.log('🧹 Closing form and resetting state');
      setShowClientForm(false);
      setEditingClient(null);
      setClientForm({
        phone: '', first_name: '', last_name: '', email: '', date_of_birth: '',
        nif: '', address_line1: '', address_line2: '', city: '', postal_code: '', district: '', country: 'Portugal',
        notes: '', is_enterprise: false, company_name: '', is_active: true
      });

      console.log('🔄 Fetching updated data...');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
      console.log('🟢🟢🟢 ==========================================\n');
    } catch (err) {
      console.error('❌❌❌ ==========================================');
      console.error('❌ FRONTEND ERROR IN handleCreateClient!');
      console.error('❌ Error object:', err);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error response:', err.response);
      console.error('❌ Error response data:', err.response?.data);
      console.error('❌ Error response status:', err.response?.status);
      console.error('❌ Error response headers:', err.response?.headers);
      console.error('❌ Error config:', err.config);
      console.error('❌❌❌ ==========================================\n');
      setError(err.response?.data?.error || 'Failed to save client');
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      phone: client.phone || '',
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      email: client.email || '',
      date_of_birth: formatDateForInput(client.date_of_birth),
      nif: client.nif || '',
      address_line1: client.address_line1 || '',
      address_line2: client.address_line2 || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      district: client.district || '',
      country: client.country || 'Portugal',
      notes: client.notes || '',
      is_enterprise: client.is_enterprise || false,
      company_name: client.company_name || '',
      is_active: client.is_active !== undefined ? client.is_active : true
    });
    setShowClientForm(true);
  };

  const handleCreateCleaningJob = async (e) => {
    e.preventDefault();
    try {
      if (editingCleaningJob) {
        await axios.put(`/api/cleaning-jobs/${editingCleaningJob.id}`, cleaningJobForm);
        setSuccess('Cleaning job updated successfully');
      } else {
        await axios.post('/api/cleaning-jobs', cleaningJobForm);
        setSuccess('Cleaning job created successfully');
      }
      setShowCleaningJobForm(false);
      setEditingCleaningJob(null);
      setCleaningJobForm({
        client_id: '', job_type: 'airbnb', property_name: '', address_line1: '',
        address_line2: '', city: '', postal_code: '', district: '', country: 'Portugal',
        scheduled_date: '', scheduled_time: '', assigned_worker_ids: [], estimated_hours: '',
        hourly_rate: 15.00, special_instructions: '', notes: ''
      });
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save cleaning job');
    }
  };

  const handleEditCleaningJob = (job) => {
    setEditingCleaningJob(job);
    setCleaningJobForm({
      client_id: job.client_id,
      job_type: job.job_type,
      property_name: job.property_name || '',
      address_line1: job.address_line1,
      address_line2: job.address_line2 || '',
      city: job.city,
      postal_code: job.postal_code || '',
      scheduled_date: job.scheduled_date ? job.scheduled_date.split('T')[0] : '',
      scheduled_time: job.scheduled_time || '',
      assigned_worker_id: job.assigned_worker_id || '',
      hourly_rate: job.hourly_rate || 15.00,
      special_instructions: job.special_instructions || ''
    });
    setShowCleaningJobForm(true);
  };

  const handleCreateLaundryOrder = async (e) => {
    e.preventDefault();
    try {
      if (editingLaundryOrder) {
        await axios.put(`/api/laundry-orders/${editingLaundryOrder.id}`, laundryOrderForm);
        setSuccess('Laundry order updated successfully');
      } else {
        await axios.post('/api/laundry-orders', laundryOrderForm);
        setSuccess('Laundry order created successfully');
      }
      setShowLaundryOrderForm(false);
      setEditingLaundryOrder(null);
      setLaundryOrderForm({
        client_id: '', order_type: 'bulk_kg', total_weight_kg: '',
        price_per_kg: 3.50, expected_ready_date: '', assigned_worker_id: '', special_instructions: '', items: [],
        service_id: '', delivery_requested: false
      });
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save laundry order');
    }
  };

  const handleEditLaundryOrder = (order) => {
    setEditingLaundryOrder(order);
    setLaundryOrderForm({
      client_id: order.client_id,
      order_type: order.order_type,
      total_weight_kg: order.total_weight_kg || '',
      price_per_kg: order.price_per_kg || 3.50,
      expected_ready_date: order.expected_ready_date ? order.expected_ready_date.split('T')[0] : '',
      special_instructions: order.special_instructions || '',
      items: [],
      service_id: order.service_id || '',
      delivery_requested: order.delivery_requested || false
    });
    setShowLaundryOrderForm(true);
  };

  const handleAddLaundryItem = () => {
    setLaundryOrderForm({
      ...laundryOrderForm,
      items: [...laundryOrderForm.items, { ...laundryItem }]
    });
    setLaundryItem({
      item_type: '', item_category: 'clothing', quantity: 1, unit_price: 3.50, special_treatment: ''
    });
  };

  const handleRemoveLaundryItem = (index) => {
    setLaundryOrderForm({
      ...laundryOrderForm,
      items: laundryOrderForm.items.filter((_, i) => i !== index)
    });
  };

  const handleMarkReady = async (orderId) => {
    try {
      const res = await axios.post(`/api/laundry-orders/${orderId}/mark-ready`);
      setSuccess(res.data.message);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to mark order ready');
    }
  };

  const handleViewOrderDetail = async (orderId, orderType = 'laundry') => {
    setLoadingOrderDetail(true);
    setViewingOrderDetail({ id: orderId, type: orderType });
    try {
      const endpoint = orderType === 'laundry'
        ? `/api/laundry-orders/${orderId}/full`
        : `/api/cleaning-jobs/${orderId}/full`;
      const res = await axios.get(endpoint);
      setOrderDetailData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load order details');
      setViewingOrderDetail(null);
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  const handleCloseOrderDetail = () => {
    setViewingOrderDetail(null);
    setOrderDetailData(null);
  };

  const handleUpdateOrderStatus = async (orderId, orderType, newStatus) => {
    try {
      const endpoint = orderType === 'laundry'
        ? `/api/laundry-orders/${orderId}/status`
        : `/api/cleaning-jobs/${orderId}`;

      if (orderType === 'laundry') {
        await axios.patch(endpoint, { status: newStatus });
      } else {
        await axios.put(endpoint, { status: newStatus });
      }

      setSuccess('Status updated successfully');
      fetchData();
      handleViewOrderDetail(orderId, orderType); // Refresh detail view
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`/api/users/${userId}`);
        setSuccess('User deleted');
        fetchData();
        setTimeout(() => setSuccess(''), 3000);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Lavandaria Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Welcome, {user?.userName || 'User'} ({user?.userType})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>

              {(isMaster || isAdmin) && (
                <>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-3 border-b-2 font-medium text-sm ${
                      activeTab === 'users'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {isMaster ? 'All Users' : 'Workers'}
                  </button>
                  <button
                    onClick={() => setActiveTab('clients')}
                    className={`px-6 py-3 border-b-2 font-medium text-sm ${
                      activeTab === 'clients'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Clients
                  </button>
                </>
              )}

              <button
                onClick={() => setActiveTab('jobs')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'jobs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {isWorker ? 'My Jobs' : 'All Jobs'}
              </button>

              <button
                onClick={() => setActiveTab('cleaningJobs')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'cleaningJobs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Cleaning Jobs
              </button>

              <button
                onClick={() => setActiveTab('laundryOrders')}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === 'laundryOrders'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Laundry Orders
              </button>

              {isWorker && (
                <button
                  onClick={() => setActiveTab('contacts')}
                  className={`px-6 py-3 border-b-2 font-medium text-sm ${
                    activeTab === 'contacts'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Client Contacts
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(isMaster || isAdmin) && (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Clients</h3>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalClients || clients.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Orders</h3>
                  <p className="text-3xl font-bold text-green-600">{stats.totalOrders || (airbnbOrders.length + laundryOrders.length)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Revenue</h3>
                  <p className="text-3xl font-bold text-purple-600">€{stats.totalRevenue?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Pending</h3>
                  <p className="text-3xl font-bold text-orange-600">{stats.pendingOrders || 0}</p>
                </div>
              </>
            )}
            {isWorker && (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Assigned Jobs</h3>
                  <p className="text-3xl font-bold text-blue-600">{airbnbOrders.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Today's Jobs</h3>
                  <p className="text-3xl font-bold text-green-600">
                    {airbnbOrders.filter(o => new Date(o.scheduled_date).toDateString() === new Date().toDateString()).length}
                  </p>
                </div>
              </>
            )}
            {isClient && (
              <>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Your Orders</h3>
                  <p className="text-3xl font-bold text-blue-600">{airbnbOrders.length + laundryOrders.length}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Users Tab (Master/Admin only) */}
        {activeTab === 'users' && (isMaster || isAdmin) && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{isMaster ? 'All Users' : 'Workers'}</h2>
              <button
                onClick={() => setShowUserForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add {isAdmin ? 'Worker' : 'User'}
              </button>
            </div>
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Username</th>
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-left py-2 px-4">Role</th>
                    <th className="text-left py-2 px-4">Email</th>
                    <th className="text-left py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(isMaster ? users : workers).map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{u.username}</td>
                      <td className="py-3 px-4">{u.full_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          u.role === 'master' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">{u.email || '-'}</td>
                      <td className="py-3 px-4">
                        {u.role !== 'master' && (
                          <>
                            <button
                              onClick={() => handleEditUser(u)}
                              className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clients Tab (Master/Admin only) */}
        {activeTab === 'clients' && (isMaster || isAdmin) && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Clients</h2>
              <button
                onClick={() => setShowClientForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Client
              </button>
            </div>
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-left py-2 px-4">Phone</th>
                    <th className="text-left py-2 px-4">Email</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-left py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{client.full_name}</td>
                      <td className="py-3 px-4">{client.phone}</td>
                      <td className="py-3 px-4">{client.email || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          client.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {client.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleEditClient(client)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">
                  {isWorker ? 'My Cleaning Jobs' : 'Cleaning Jobs'}
                </h2>
              </div>
              <div className="p-6">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Type</th>
                      <th className="text-left py-2 px-4">Client</th>
                      <th className="text-left py-2 px-4">Property</th>
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-left py-2 px-4">Status</th>
                      {(isMaster || isAdmin) && <th className="text-left py-2 px-4">Cost</th>}
                      <th className="text-left py-2 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleaningJobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded ${job.job_type === 'airbnb' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                            {job.job_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">{job.client_name || 'N/A'}</td>
                        <td className="py-3 px-4">{job.property_address || 'N/A'}</td>
                        <td className="py-3 px-4">{new Date(job.scheduled_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 text-xs rounded ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        {(isMaster || isAdmin) && (
                          <td className="py-3 px-4">€{job.total_cost || '0.00'}</td>
                        )}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleViewOrderDetail(job.id, 'cleaning')}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cleaningJobs.length === 0 && (
                      <tr>
                        <td colSpan="7" className="py-4 px-4 text-center text-gray-500">No cleaning jobs found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {!isWorker && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">Laundry Orders</h2>
                </div>
                <div className="p-6">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Order #</th>
                        <th className="text-left py-2 px-4">Client</th>
                        <th className="text-left py-2 px-4">Type</th>
                        <th className="text-left py-2 px-4">Status</th>
                        {(isMaster || isAdmin) && <th className="text-left py-2 px-4">Total</th>}
                        <th className="text-left py-2 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laundryOrdersNew.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{order.order_number}</td>
                          <td className="py-3 px-4">{order.client_name || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded ${
                              order.order_type === 'bulk_kg' ? 'bg-blue-100 text-blue-700' :
                              order.order_type === 'itemized' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {order.order_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 text-xs rounded ${
                              order.status === 'collected' ? 'bg-green-100 text-green-700' :
                              order.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                              order.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          {(isMaster || isAdmin) && (
                            <td className="py-3 px-4">€{order.total_price}</td>
                          )}
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleViewOrderDetail(order.id, 'laundry')}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                      {laundryOrdersNew.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-4 px-4 text-center text-gray-500">No laundry orders found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Client Contacts Tab (Workers only) */}
        {activeTab === 'contacts' && isWorker && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Client Contacts</h2>
            </div>
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Name</th>
                    <th className="text-left py-2 px-4">Phone</th>
                    <th className="text-left py-2 px-4">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{client.full_name}</td>
                      <td className="py-3 px-4">
                        <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                          {client.phone}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        {client.email ? (
                          <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                            {client.email}
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cleaning Jobs Tab */}
        {activeTab === 'cleaningJobs' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Cleaning Jobs</h2>
              {(isMaster || isAdmin) && (
                <button
                  onClick={() => setShowCleaningJobForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Cleaning Job
                </button>
              )}
            </div>
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Client</th>
                    <th className="text-left py-2 px-4">Address</th>
                    <th className="text-left py-2 px-4">Scheduled</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-left py-2 px-4">Cost</th>
                    {(isMaster || isAdmin) && <th className="text-left py-2 px-4">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {cleaningJobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded ${job.job_type === 'airbnb' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {job.job_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">{job.client_name}</td>
                      <td className="py-3 px-4">{job.property_address}</td>
                      <td className="py-3 px-4">
                        {new Date(job.scheduled_date).toLocaleDateString()} {job.scheduled_time}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          job.status === 'completed' ? 'bg-green-100 text-green-700' :
                          job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">€{job.total_cost || '0.00'}</td>
                      {(isMaster || isAdmin) && (
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewOrderDetail(job.id, 'cleaning')}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => handleEditCleaningJob(job)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {cleaningJobs.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-4 px-4 text-center text-gray-500">No cleaning jobs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Laundry Orders Tab */}
        {activeTab === 'laundryOrders' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Laundry Orders</h2>
              {(isMaster || isAdmin) && (
                <button
                  onClick={() => setShowLaundryOrderForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Laundry Order
                </button>
              )}
            </div>
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">Order #</th>
                    <th className="text-left py-2 px-4">Client</th>
                    <th className="text-left py-2 px-4">Type</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-left py-2 px-4">Total</th>
                    <th className="text-left py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {laundryOrdersNew.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{order.order_number}</td>
                      <td className="py-3 px-4">{order.client_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          order.order_type === 'bulk_kg' ? 'bg-blue-100 text-blue-700' :
                          order.order_type === 'itemized' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {order.order_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          order.status === 'collected' ? 'bg-green-100 text-green-700' :
                          order.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">€{order.total_price}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewOrderDetail(order.id, 'laundry')}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            View Details
                          </button>
                          {(isMaster || isAdmin) && (
                            <button
                              onClick={() => handleEditLaundryOrder(order)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                          )}
                          {!isClient && order.status !== 'ready' && order.status !== 'collected' && (
                            <button
                              onClick={() => handleMarkReady(order.id)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                            >
                              Mark Ready
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {laundryOrdersNew.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-4 px-4 text-center text-gray-500">No laundry orders found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* User Form Modal */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <form onSubmit={handleCreateUser} className="space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username {!editingUser && '*'}
                  </label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: sanitizeUsername(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    required={!editingUser}
                    placeholder="Auto-generated from first and last name"
                    readOnly={editingUser}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingUser
                      ? 'Username cannot be changed'
                      : 'Automatically generated from first and last name (you can edit it)'}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {!editingUser && '*'} {editingUser && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required={!editingUser}
                    placeholder={editingUser ? 'Leave blank to keep current password' : ''}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={editingUser && editingUser.role === 'master'}
                  >
                    {isMaster && <option value="master">Master</option>}
                    {(isMaster || isAdmin) && <option value="admin">Admin</option>}
                    <option value="worker">Worker</option>
                  </select>
                  {editingUser && editingUser.role === 'master' && (
                    <p className="text-sm text-gray-500 mt-1">Master role cannot be changed</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={userForm.first_name}
                    onChange={(e) => {
                      const newFirstName = e.target.value;
                      const newUsername = generateUsername(newFirstName, userForm.last_name);
                      setUserForm({ ...userForm, first_name: newFirstName, username: newUsername });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={userForm.last_name}
                    onChange={(e) => {
                      const newLastName = e.target.value;
                      const newUsername = generateUsername(userForm.first_name, newLastName);
                      setUserForm({ ...userForm, last_name: newLastName, username: newUsername });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={userForm.date_of_birth}
                    onChange={(e) => setUserForm({ ...userForm, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIF (Tax ID) *</label>
                  <input
                    type="text"
                    value={userForm.nif}
                    onChange={(e) => setUserForm({ ...userForm, nif: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="123456789"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={userForm.address_line1}
                    onChange={(e) => setUserForm({ ...userForm, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Street name and number"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={userForm.address_line2}
                    onChange={(e) => setUserForm({ ...userForm, address_line2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Apartment, floor, building (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={userForm.city}
                    onChange={(e) => setUserForm({ ...userForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Lisboa, Porto, etc."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={userForm.postal_code}
                    onChange={(e) => setUserForm({ ...userForm, postal_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="XXXX-XXX (e.g., 1000-001)"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <select
                    value={userForm.district}
                    onChange={(e) => setUserForm({ ...userForm, district: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select District</option>
                    <option value="Aveiro">Aveiro</option>
                    <option value="Beja">Beja</option>
                    <option value="Braga">Braga</option>
                    <option value="Bragança">Bragança</option>
                    <option value="Castelo Branco">Castelo Branco</option>
                    <option value="Coimbra">Coimbra</option>
                    <option value="Évora">Évora</option>
                    <option value="Faro">Faro</option>
                    <option value="Guarda">Guarda</option>
                    <option value="Leiria">Leiria</option>
                    <option value="Lisboa">Lisboa</option>
                    <option value="Portalegre">Portalegre</option>
                    <option value="Porto">Porto</option>
                    <option value="Santarém">Santarém</option>
                    <option value="Setúbal">Setúbal</option>
                    <option value="Viana do Castelo">Viana do Castelo</option>
                    <option value="Vila Real">Vila Real</option>
                    <option value="Viseu">Viseu</option>
                    <option value="Açores">Açores</option>
                    <option value="Madeira">Madeira</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userForm.is_active}
                      onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active (user can login)</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Form Modal */}
      {showClientForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
            <form onSubmit={handleCreateClient} className="space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {/* Client Type Toggle */}
                <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Client Type *</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!clientForm.is_enterprise}
                        onChange={() => setClientForm({ ...clientForm, is_enterprise: false })}
                        className="mr-2"
                      />
                      <span>Individual Person</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={clientForm.is_enterprise}
                        onChange={() => setClientForm({ ...clientForm, is_enterprise: true })}
                        className="mr-2"
                      />
                      <span>Enterprise/Company</span>
                    </label>
                  </div>
                </div>

                {/* Company Name (only for enterprises) */}
                {clientForm.is_enterprise && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={clientForm.company_name}
                      onChange={(e) => setClientForm({ ...clientForm, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      required={clientForm.is_enterprise}
                    />
                  </div>
                )}

                {/* First & Last Name (only for individuals) */}
                {!clientForm.is_enterprise && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={clientForm.first_name}
                        onChange={(e) => setClientForm({ ...clientForm, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required={!clientForm.is_enterprise}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={clientForm.last_name}
                        onChange={(e) => setClientForm({ ...clientForm, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required={!clientForm.is_enterprise}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={clientForm.date_of_birth}
                        onChange={(e) => setClientForm({ ...clientForm, date_of_birth: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required={!clientForm.is_enterprise}
                      />
                    </div>
                  </>
                )}

                {/* Common fields for both types */}
                <div className={!clientForm.is_enterprise ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="912345678"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIF (Tax ID) *</label>
                  <input
                    type="text"
                    value={clientForm.nif}
                    onChange={(e) => setClientForm({ ...clientForm, nif: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="123456789"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={clientForm.address_line1}
                    onChange={(e) => setClientForm({ ...clientForm, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Street name and number"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={clientForm.address_line2}
                    onChange={(e) => setClientForm({ ...clientForm, address_line2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Apartment, floor, building (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={clientForm.city}
                    onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Lisboa, Porto, etc."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={clientForm.postal_code}
                    onChange={(e) => setClientForm({ ...clientForm, postal_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="XXXX-XXX (e.g., 1000-001)"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                  <select
                    value={clientForm.district}
                    onChange={(e) => setClientForm({ ...clientForm, district: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select District</option>
                    <option value="Aveiro">Aveiro</option>
                    <option value="Beja">Beja</option>
                    <option value="Braga">Braga</option>
                    <option value="Bragança">Bragança</option>
                    <option value="Castelo Branco">Castelo Branco</option>
                    <option value="Coimbra">Coimbra</option>
                    <option value="Évora">Évora</option>
                    <option value="Faro">Faro</option>
                    <option value="Guarda">Guarda</option>
                    <option value="Leiria">Leiria</option>
                    <option value="Lisboa">Lisboa</option>
                    <option value="Portalegre">Portalegre</option>
                    <option value="Porto">Porto</option>
                    <option value="Santarém">Santarém</option>
                    <option value="Setúbal">Setúbal</option>
                    <option value="Viana do Castelo">Viana do Castelo</option>
                    <option value="Vila Real">Vila Real</option>
                    <option value="Viseu">Viseu</option>
                    <option value="Açores">Açores</option>
                    <option value="Madeira">Madeira</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={clientForm.notes}
                    onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clientForm.is_active}
                      onChange={(e) => setClientForm({ ...clientForm, is_active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active (client can login)</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingClient ? 'Update Client' : 'Create Client'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClientForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cleaning Job Form Modal */}
      {showCleaningJobForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingCleaningJob ? 'Edit Cleaning Job' : 'Create Cleaning Job'}</h3>
            <form onSubmit={handleCreateCleaningJob} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
                  <select
                    value={cleaningJobForm.job_type}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, job_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="airbnb">Airbnb</option>
                    <option value="house">House</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                  <select
                    value={cleaningJobForm.client_id}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, client_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
                  <input
                    type="text"
                    value={cleaningJobForm.property_name}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, property_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., Riverside Apartment 3A"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    value={cleaningJobForm.address_line1}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Street address"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={cleaningJobForm.address_line2}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, address_line2: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={cleaningJobForm.city}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={cleaningJobForm.postal_code}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, postal_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    value={cleaningJobForm.scheduled_date}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time *</label>
                  <input
                    type="time"
                    value={cleaningJobForm.scheduled_time}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, scheduled_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={cleaningJobForm.estimated_hours}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, estimated_hours: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g., 2.5"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Used to calculate estimated cost</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cleaningJobForm.hourly_rate}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, hourly_rate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign Workers (Multiple) *</label>
                  <div className="border rounded-lg p-3 max-h-32 overflow-y-auto bg-gray-50">
                    {(isMaster ? users : workers).filter(u => u.role === 'worker' || u.role === 'admin').length === 0 ? (
                      <p className="text-sm text-gray-500">No workers available</p>
                    ) : (
                      <div className="space-y-2">
                        {(isMaster ? users : workers).filter(u => u.role === 'worker' || u.role === 'admin').map(w => (
                          <label key={w.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={(cleaningJobForm.assigned_worker_ids || []).includes(w.id)}
                              onChange={(e) => {
                                const currentWorkers = cleaningJobForm.assigned_worker_ids || [];
                                if (e.target.checked) {
                                  setCleaningJobForm({
                                    ...cleaningJobForm,
                                    assigned_worker_ids: [...currentWorkers, w.id]
                                  });
                                } else {
                                  setCleaningJobForm({
                                    ...cleaningJobForm,
                                    assigned_worker_ids: currentWorkers.filter(id => id !== w.id)
                                  });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm">
                              {w.full_name || w.username}
                              {w.role === 'admin' && <span className="ml-1 text-xs text-blue-600">(Admin)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Select all workers who will work on this job. Admins can also be assigned. Selected: {(cleaningJobForm.assigned_worker_ids || []).length}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <textarea
                    value={cleaningJobForm.special_instructions}
                    onChange={(e) => setCleaningJobForm({ ...cleaningJobForm, special_instructions: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows="3"
                    placeholder="Any special requirements or notes..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Create Job
                </button>
                <button
                  type="button"
                  onClick={() => setShowCleaningJobForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Laundry Order Form Modal */}
      {showLaundryOrderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingLaundryOrder ? 'Edit Laundry Order' : 'Create Laundry Order'}</h3>
            <form onSubmit={handleCreateLaundryOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                  <select
                    value={laundryOrderForm.client_id}
                    onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, client_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Type *</label>
                  <select
                    value={laundryOrderForm.order_type}
                    onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, order_type: e.target.value, items: [] })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="bulk_kg">Bulk by Kilograms</option>
                    <option value="itemized">Itemized (Individual Items)</option>
                    <option value="house_bundle">House Bundle</option>
                  </select>
                </div>

                {laundryOrderForm.order_type === 'bulk_kg' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                    <select
                      value={laundryOrderForm.service_id}
                      onChange={(e) => {
                        const serviceId = e.target.value;
                        const service = laundryServices.find(s => s.id === parseInt(serviceId));
                        setLaundryOrderForm({
                          ...laundryOrderForm,
                          service_id: serviceId,
                          price_per_kg: service ? parseFloat(service.base_price) : 3.50
                        });
                      }}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    >
                      <option value="">Select service...</option>
                      {laundryServices.map(service => (
                        <option key={service.id} value={service.id}>
                          {service.service_name} - €{parseFloat(service.base_price).toFixed(2)}/{service.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {laundryOrderForm.order_type === 'bulk_kg' && laundryOrderForm.service_id && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Weight (kg) *</label>
                      <input
                        type="number"
                        step="0.1"
                        value={laundryOrderForm.total_weight_kg}
                        onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, total_weight_kg: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price per kg (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={laundryOrderForm.price_per_kg}
                        onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, price_per_kg: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg"
                        required
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Ready Date *</label>
                  <input
                    type="date"
                    value={laundryOrderForm.expected_ready_date}
                    onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, expected_ready_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={laundryOrderForm.delivery_requested}
                      onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, delivery_requested: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Delivery Requested (additional fee applies)</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <textarea
                    value={laundryOrderForm.special_instructions}
                    onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, special_instructions: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows="2"
                  />
                </div>

                {(laundryOrderForm.order_type === 'itemized' || laundryOrderForm.order_type === 'house_bundle') && (
                  <div className="col-span-2 border-t pt-4">
                    <h4 className="font-medium mb-3">Items</h4>

                    {/* Item input form */}
                    <div className="bg-gray-50 p-3 rounded-lg mb-3 grid grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={laundryItem.item_type}
                        onChange={(e) => setLaundryItem({ ...laundryItem, item_type: e.target.value })}
                        placeholder="Item type"
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <input
                        type="number"
                        value={laundryItem.quantity}
                        onChange={(e) => setLaundryItem({ ...laundryItem, quantity: parseInt(e.target.value) })}
                        placeholder="Qty"
                        className="px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={laundryItem.unit_price}
                        onChange={(e) => setLaundryItem({ ...laundryItem, unit_price: parseFloat(e.target.value) })}
                        placeholder="Price"
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <input
                        type="text"
                        value={laundryItem.special_treatment}
                        onChange={(e) => setLaundryItem({ ...laundryItem, special_treatment: e.target.value })}
                        placeholder="Treatment"
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddLaundryItem}
                        className="bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        disabled={!laundryItem.item_type}
                      >
                        Add
                      </button>
                    </div>

                    {/* Items list */}
                    {laundryOrderForm.items.length > 0 && (
                      <div className="space-y-2">
                        {laundryOrderForm.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center bg-white p-2 rounded border text-sm">
                            <span>{item.quantity}x {item.item_type} - €{item.unit_price} each</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveLaundryItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Worker Assignment */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Worker/Admin (Optional)</label>
                  <select
                    value={laundryOrderForm.assigned_worker_id}
                    onChange={(e) => setLaundryOrderForm({ ...laundryOrderForm, assigned_worker_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {(isMaster ? users : workers).filter(u => u.role === 'worker' || u.role === 'admin').map(w => (
                      <option key={w.id} value={w.id}>
                        {w.full_name || w.username}{w.role === 'admin' ? ' (Admin)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Optionally assign a worker or admin to handle this laundry order</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Create Order
                </button>
                <button
                  type="button"
                  onClick={() => setShowLaundryOrderForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {viewingOrderDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {loadingOrderDetail ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading order details...</p>
              </div>
            ) : orderDetailData ? (
              <>
                {/* Header */}
                <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {viewingOrderDetail.type === 'laundry' ? 'Laundry Order Details' : 'Cleaning Job Details'}
                      </h2>
                      <p className="text-blue-100 mt-1">
                        {viewingOrderDetail.type === 'laundry'
                          ? orderDetailData.order.order_number
                          : `Job #${orderDetailData.job.id}`}
                      </p>
                    </div>
                    <button
                      onClick={handleCloseOrderDetail}
                      className="text-white hover:text-gray-200 text-2xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {viewingOrderDetail.type === 'laundry' ? (
                    <>
                      {/* Laundry Order Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Client Information</h3>
                          <div className="space-y-2 text-sm">
                            <p><span className="font-medium">Name:</span> {orderDetailData.order.client_name}</p>
                            <p><span className="font-medium">Phone:</span> {orderDetailData.order.client_phone}</p>
                            {orderDetailData.order.client_email && (
                              <p><span className="font-medium">Email:</span> {orderDetailData.order.client_email}</p>
                            )}
                            {orderDetailData.order.client_address && (
                              <p><span className="font-medium">Address:</span> {orderDetailData.order.client_address}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Order Details</h3>
                          <div className="space-y-2 text-sm">
                            <p><span className="font-medium">Type:</span> <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">{orderDetailData.order.order_type}</span></p>
                            <p><span className="font-medium">Status:</span>
                              <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                orderDetailData.order.status === 'collected' ? 'bg-green-100 text-green-700' :
                                orderDetailData.order.status === 'ready' ? 'bg-blue-100 text-blue-700' :
                                orderDetailData.order.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {orderDetailData.order.status}
                              </span>
                            </p>
                            {orderDetailData.order.total_weight_kg && (
                              <p><span className="font-medium">Weight:</span> {orderDetailData.order.total_weight_kg} kg</p>
                            )}
                            <p><span className="font-medium">Created:</span> {new Date(orderDetailData.order.created_at).toLocaleString()}</p>
                            {orderDetailData.order.expected_ready_date && (
                              <p><span className="font-medium">Expected Ready:</span> {new Date(orderDetailData.order.expected_ready_date).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      {orderDetailData.items && orderDetailData.items.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Order Items</h3>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unit Price</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {orderDetailData.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-2 text-sm">{item.item_type}</td>
                                    <td className="px-4 py-2 text-sm">{item.quantity}</td>
                                    <td className="px-4 py-2 text-sm">€{item.unit_price}</td>
                                    <td className="px-4 py-2 text-sm font-medium">€{item.total_price}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Pricing */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-700 mb-3">Pricing Breakdown</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Base Price:</span>
                            <span className="font-medium">€{orderDetailData.order.base_price}</span>
                          </div>
                          {orderDetailData.order.additional_charges > 0 && (
                            <div className="flex justify-between text-orange-600">
                              <span>Additional Charges:</span>
                              <span className="font-medium">+€{orderDetailData.order.additional_charges}</span>
                            </div>
                          )}
                          {orderDetailData.order.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount:</span>
                              <span className="font-medium">-€{orderDetailData.order.discount}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t-2 border-gray-300 text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-blue-600">€{orderDetailData.order.total_price}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Payment Status:</span>
                            <span className={`px-2 py-1 text-xs rounded ${
                              orderDetailData.order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {orderDetailData.order.payment_status || 'pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Cleaning Job Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Client Information</h3>
                          <div className="space-y-2 text-sm">
                            <p><span className="font-medium">Name:</span> {orderDetailData.job.client_name}</p>
                            <p><span className="font-medium">Phone:</span> {orderDetailData.job.client_phone}</p>
                            {orderDetailData.job.client_email && (
                              <p><span className="font-medium">Email:</span> {orderDetailData.job.client_email}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Job Details</h3>
                          <div className="space-y-2 text-sm">
                            <p><span className="font-medium">Type:</span> <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">{orderDetailData.job.job_type}</span></p>
                            <p><span className="font-medium">Status:</span>
                              <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                orderDetailData.job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                orderDetailData.job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {orderDetailData.job.status}
                              </span>
                            </p>
                            <p><span className="font-medium">Property:</span> {orderDetailData.job.property_address}</p>
                            <p><span className="font-medium">Scheduled:</span> {new Date(orderDetailData.job.scheduled_date).toLocaleDateString()} {orderDetailData.job.scheduled_time}</p>
                            {orderDetailData.job.worker_name && (
                              <p><span className="font-medium">Assigned Worker:</span> {orderDetailData.job.worker_name}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Photos */}
                      {orderDetailData.photos && orderDetailData.photos.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Cleaning Photos ({orderDetailData.photos.length})</h3>
                          <div className="grid grid-cols-3 gap-3">
                            {orderDetailData.photos.map((photo) => (
                              <div key={photo.id} className="relative">
                                <img
                                  src={photo.photo_url}
                                  alt={photo.caption || 'Cleaning photo'}
                                  className="w-full h-32 object-cover rounded-lg border"
                                />
                                <div className="mt-1 text-xs text-gray-600">
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded">{photo.photo_type}</span>
                                  {photo.room_area && <span className="ml-1">{photo.room_area}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Time Logs */}
                      {orderDetailData.timeLogs && orderDetailData.timeLogs.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-700 mb-3">Time Tracking</h3>
                          <div className="space-y-2">
                            {orderDetailData.timeLogs.map((log) => (
                              <div key={log.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                <div className="text-sm">
                                  <p className="font-medium">{log.worker_name}</p>
                                  <p className="text-gray-600">
                                    {new Date(log.start_time).toLocaleString()}
                                    {log.end_time && ` - ${new Date(log.end_time).toLocaleString()}`}
                                  </p>
                                </div>
                                {log.duration_minutes && (
                                  <span className="text-sm font-semibold text-blue-600">
                                    {Math.round(log.duration_minutes)} min
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Payments Section (Common for both) */}
                  {orderDetailData.payments && orderDetailData.payments.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-3">Payment History</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Method</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {orderDetailData.payments.map((payment) => (
                              <tr key={payment.id}>
                                <td className="px-4 py-2 text-sm">{new Date(payment.payment_date).toLocaleString()}</td>
                                <td className="px-4 py-2 text-sm capitalize">{payment.payment_method}</td>
                                <td className="px-4 py-2 text-sm font-medium text-green-600">€{payment.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Status Update Section (Master/Admin only) */}
                  {(isMaster || isAdmin) && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-700 mb-3">Update Status</h3>
                      <div className="flex gap-2">
                        {viewingOrderDetail.type === 'laundry' ? (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'laundry', 'received')}
                              className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                              Mark Received
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'laundry', 'in_progress')}
                              className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                            >
                              Mark In Progress
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'laundry', 'ready')}
                              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Mark Ready
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'laundry', 'collected')}
                              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Mark Collected
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'cleaning', 'scheduled')}
                              className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                              Mark Scheduled
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'cleaning', 'in_progress')}
                              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Mark In Progress
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(viewingOrderDetail.id, 'cleaning', 'completed')}
                              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                            >
                              Mark Completed
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                  <button
                    onClick={handleCloseOrderDetail}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
