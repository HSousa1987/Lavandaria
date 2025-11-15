import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserModal = ({ isOpen, onClose, onSuccess, editingUser }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role_id: '',
        name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        nif: ''
    });
    const [roleTypes, setRoleTypes] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Fetch role types on mount
    useEffect(() => {
        const fetchRoleTypes = async () => {
            try {
                const response = await axios.get('/api/role-types');
                setRoleTypes(response.data.data || response.data);
            } catch (err) {
                console.error('Error fetching role types:', err);
                setError('Failed to load role types');
            }
        };

        if (isOpen) {
            fetchRoleTypes();
        }
    }, [isOpen]);

    // Load editing user data
    useEffect(() => {
        if (editingUser) {
            setFormData({
                username: editingUser.username || '',
                password: '', // Don't pre-fill password
                role_id: editingUser.role_id || '',
                name: editingUser.name || '',
                email: editingUser.email || '',
                phone: editingUser.phone || '',
                date_of_birth: editingUser.date_of_birth || '',
                nif: editingUser.nif || ''
            });
        } else {
            setFormData({
                username: '',
                password: '',
                role_id: '',
                name: '',
                email: '',
                phone: '',
                date_of_birth: '',
                nif: ''
            });
        }
        setError('');
    }, [editingUser, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (editingUser) {
                await axios.put(`/api/users/${editingUser.id}`, formData);
            } else {
                await axios.post('/api/users', formData);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error saving user:', err);
            setError(err.response?.data?.error || 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {editingUser ? 'Edit User' : 'Add User'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        &times;
                    </button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Username <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                                disabled={!!editingUser}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Password {!editingUser && <span className="text-red-500">*</span>}
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required={!editingUser}
                                placeholder={editingUser ? 'Leave blank to keep current' : ''}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Role <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="role_id"
                                value={formData.role_id}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required
                            >
                                <option value="">Select Role</option>
                                {roleTypes.map(rt => (
                                    <option key={rt.id} value={rt.id}>
                                        {rt.role_name || rt.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                placeholder="e.g., João Silva"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Phone</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">Date of Birth</label>
                            <input
                                type="date"
                                name="date_of_birth"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">NIF</label>
                            <input
                                type="text"
                                name="nif"
                                value={formData.nif}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border rounded-lg hover:bg-gray-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {loading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserModal;
