import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ClientModal = ({ isOpen, onClose, onSuccess, editingClient }) => {
    const [formData, setFormData] = useState({
        phone: '',
        name: '',
        email: '',
        date_of_birth: '',
        nif: '',
        notes: '',
        is_enterprise: false,
        company_name: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editingClient) {
            setFormData({
                phone: editingClient.phone || '',
                name: editingClient.name || '',
                email: editingClient.email || '',
                date_of_birth: editingClient.date_of_birth || '',
                nif: editingClient.nif || '',
                notes: editingClient.notes || '',
                is_enterprise: editingClient.is_enterprise || false,
                company_name: editingClient.company_name || ''
            });
        } else {
            setFormData({
                phone: '',
                name: '',
                email: '',
                date_of_birth: '',
                nif: '',
                notes: '',
                is_enterprise: false,
                company_name: ''
            });
        }
        setError('');
    }, [editingClient, isOpen]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (editingClient) {
                await axios.put(`/api/clients/${editingClient.id}`, formData);
            } else {
                await axios.post('/api/clients', formData);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Error saving client:', err);
            setError(err.response?.data?.error || 'Failed to save client');
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
                        {editingClient ? 'Edit Client' : 'Add Client'}
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
                    <div className="mb-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                name="is_enterprise"
                                checked={formData.is_enterprise}
                                onChange={handleChange}
                                className="mr-2"
                            />
                            <span className="font-medium">Enterprise Client</span>
                        </label>
                    </div>

                    {formData.is_enterprise && (
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Company Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                required={formData.is_enterprise}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                {formData.is_enterprise ? 'Contact Name' : 'Full Name'}{' '}
                                <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
                                placeholder={formData.is_enterprise ? 'e.g., Maria Silva (Manager)' : 'e.g., João Silva'}
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Phone <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border rounded-lg"
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

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Notes</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border rounded-lg"
                            rows="3"
                        />
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
                            {loading ? 'Saving...' : editingClient ? 'Update Client' : 'Create Client'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClientModal;
