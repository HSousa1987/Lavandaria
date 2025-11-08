import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TaxSummary = () => {
    const [taxData, setTaxData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTaxSummary();
    }, []);

    const fetchTaxSummary = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/dashboard/tax-summary');

            if (response.data.success) {
                setTaxData(response.data.data);
            } else {
                setError(response.data.error || 'Failed to load tax summary');
            }
        } catch (err) {
            console.error('Error fetching tax summary:', err);
            setError(err.response?.data?.error || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-red-600">
                    <p className="font-semibold">Error Loading Tax Summary</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (!taxData) return null;

    const { currentPeriod, vatSummary, breakdown } = taxData;

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    Tax Summary (IVA)
                </h3>
                <span className="text-sm text-gray-500">
                    Q{currentPeriod.quarter} {currentPeriod.year}
                </span>
            </div>

            <div className="space-y-4">
                {/* Total VAT Collected */}
                <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total VAT Collected</p>
                    <p className="text-3xl font-bold text-blue-600">
                        €{vatSummary.vat.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        @ {vatSummary.vatRate}% IVA rate
                    </p>
                </div>

                {/* Revenue Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Subtotal (excl. VAT)</p>
                        <p className="text-lg font-semibold text-gray-800">
                            €{vatSummary.subtotal.toFixed(2)}
                        </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-600 mb-1">Total (incl. VAT)</p>
                        <p className="text-lg font-semibold text-gray-800">
                            €{vatSummary.totalWithVAT.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Service Breakdown */}
                <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                        VAT by Service
                    </p>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Cleaning Services</span>
                            <span className="text-sm font-semibold text-green-600">
                                €{breakdown.cleaning.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Laundry Services</span>
                            <span className="text-sm font-semibold text-purple-600">
                                €{breakdown.laundry.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Period Info */}
                <div className="text-xs text-gray-500 text-center pt-2 border-t">
                    Period: {currentPeriod.startDate} to {currentPeriod.endDate}
                </div>
            </div>
        </div>
    );
};

export default TaxSummary;
