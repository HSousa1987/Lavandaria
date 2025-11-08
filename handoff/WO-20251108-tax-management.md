# Work Order: WO-20251108-tax-management

**Created:** 2025-11-08 04:15 UTC
**Priority:** P0 (User Priority #2)
**Type:** Feature Implementation
**Estimated Duration:** 3-4 hours

---

## (i) HEADER

### Objective
Implement comprehensive tax/VAT tracking for both cleaning jobs and laundry orders to support Portuguese tax compliance and financial reporting.

### Context
User requirement: "the jobs, they have taxes and right now the app doesnt have that info"

**Business Need:**
- Lavandaria operates in Portugal (23% IVA standard rate)
- Must track VAT for quarterly tax reporting
- Need separate VAT breakdown on invoices and financial reports
- Both business lines (cleaning + laundry) require tax compliance

**Current State:**
- `cleaning_jobs` has `total_cost` (no VAT breakdown)
- `laundry_orders_new` has `total_price` (no VAT breakdown)
- No tax reporting endpoints
- Dashboard shows revenue without VAT breakdown

### Scope
- **In Scope:**
  - Add VAT fields to both `cleaning_jobs` and `laundry_orders_new` tables
  - Auto-calculate VAT on job/order creation and updates
  - Quarterly tax report API endpoints
  - Dashboard tax summary view for Admin/Master
  - Historical data migration (backfill VAT for existing records)

- **Out of Scope:**
  - Invoice PDF generation (separate WO)
  - Multi-country tax rates (Portugal-only for now)
  - Tax exemption handling (future enhancement)

---

## (ii) ACCEPTANCE CRITERIA

- [ ] Database schema updated with VAT fields (both tables)
- [ ] Automatic VAT calculation on job/order create/update (23% rate)
- [ ] Historical records backfilled with calculated VAT
- [ ] GET `/api/reports/tax/quarterly?year=2025&quarter=1` returns VAT summary
- [ ] GET `/api/reports/tax/annual?year=2025` returns annual tax report
- [ ] GET `/api/dashboard/tax-summary` shows current period tax overview
- [ ] Dashboard displays tax breakdown for Admin/Master only
- [ ] All responses use standardized envelope format
- [ ] Database triggers handle automatic VAT calculation
- [ ] No regressions in existing job/order creation flows
- [ ] E2E tests pass at ≥87.2% (no decline from baseline)
- [ ] Documentation updated in docs/progress.md, docs/decisions.md

---

## (iii) TERMINAL-FIRST PLAN

### Step 1: Database Migration (Add VAT Fields)

**File:** Create `migrations/20251108_add_vat_fields.sql`

```sql
-- ============================================
-- Migration: Add VAT fields to cleaning_jobs and laundry_orders_new
-- Date: 2025-11-08
-- Purpose: Portuguese IVA (23%) tracking for tax compliance
-- ============================================

BEGIN;

-- ===========================================
-- CLEANING JOBS TABLE
-- ===========================================

-- Add VAT columns
ALTER TABLE cleaning_jobs
ADD COLUMN subtotal_before_vat NUMERIC(10,2) DEFAULT 0,
ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 23.00,
ADD COLUMN vat_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN total_with_vat NUMERIC(10,2) DEFAULT 0;

-- Update CHECK constraint to use total_with_vat
COMMENT ON COLUMN cleaning_jobs.subtotal_before_vat IS 'Base cost before VAT (hourly_rate * hours)';
COMMENT ON COLUMN cleaning_jobs.vat_rate IS 'VAT percentage (default 23% for Portugal)';
COMMENT ON COLUMN cleaning_jobs.vat_amount IS 'Calculated VAT amount';
COMMENT ON COLUMN cleaning_jobs.total_with_vat IS 'Final total including VAT';

-- Rename total_cost to avoid confusion (optional - keep for backward compatibility)
COMMENT ON COLUMN cleaning_jobs.total_cost IS 'DEPRECATED: Use total_with_vat instead';

-- ===========================================
-- LAUNDRY ORDERS TABLE
-- ===========================================

-- Add VAT columns
ALTER TABLE laundry_orders_new
ADD COLUMN subtotal_before_vat NUMERIC(10,2) DEFAULT 0,
ADD COLUMN vat_rate NUMERIC(5,2) DEFAULT 23.00,
ADD COLUMN vat_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN total_with_vat NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN laundry_orders_new.subtotal_before_vat IS 'Base price before VAT (base_price + additional_charges - discount)';
COMMENT ON COLUMN laundry_orders_new.vat_rate IS 'VAT percentage (default 23% for Portugal)';
COMMENT ON COLUMN laundry_orders_new.vat_amount IS 'Calculated VAT amount';
COMMENT ON COLUMN laundry_orders_new.total_with_vat IS 'Final total including VAT';

COMMENT ON COLUMN laundry_orders_new.total_price IS 'DEPRECATED: Use total_with_vat instead';

-- ===========================================
-- DATABASE FUNCTIONS FOR VAT CALCULATION
-- ===========================================

-- Function: Calculate VAT for cleaning jobs
CREATE OR REPLACE FUNCTION calculate_cleaning_vat()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate subtotal (hourly_rate * estimated_hours, or use total_cost if set)
    IF NEW.total_duration_minutes IS NOT NULL AND NEW.total_duration_minutes > 0 THEN
        -- Use actual duration if available
        NEW.subtotal_before_vat := NEW.hourly_rate * (NEW.total_duration_minutes / 60.0);
    ELSIF NEW.estimated_hours IS NOT NULL THEN
        -- Use estimated hours
        NEW.subtotal_before_vat := NEW.hourly_rate * NEW.estimated_hours;
    ELSE
        -- Fallback to total_cost if no hours
        NEW.subtotal_before_vat := COALESCE(NEW.total_cost, 0);
    END IF;

    -- Calculate VAT
    NEW.vat_amount := ROUND(NEW.subtotal_before_vat * (NEW.vat_rate / 100.0), 2);

    -- Calculate total with VAT
    NEW.total_with_vat := NEW.subtotal_before_vat + NEW.vat_amount;

    -- Keep total_cost synchronized (backward compatibility)
    NEW.total_cost := NEW.total_with_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate VAT for laundry orders
CREATE OR REPLACE FUNCTION calculate_laundry_vat()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate subtotal
    IF NEW.order_type = 'bulk_kg' AND NEW.total_weight_kg IS NOT NULL THEN
        NEW.base_price := NEW.total_weight_kg * NEW.price_per_kg;
    END IF;

    NEW.subtotal_before_vat := COALESCE(NEW.base_price, 0) +
                                COALESCE(NEW.additional_charges, 0) -
                                COALESCE(NEW.discount, 0);

    -- Calculate VAT
    NEW.vat_amount := ROUND(NEW.subtotal_before_vat * (NEW.vat_rate / 100.0), 2);

    -- Calculate total with VAT
    NEW.total_with_vat := NEW.subtotal_before_vat + NEW.vat_amount;

    -- Keep total_price synchronized (backward compatibility)
    NEW.total_price := NEW.total_with_vat;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Drop existing cost calculation triggers (we're replacing them)
DROP TRIGGER IF EXISTS trigger_calculate_cleaning_cost ON cleaning_jobs;
DROP TRIGGER IF EXISTS trigger_calculate_laundry_total ON laundry_orders_new;

-- Create new VAT calculation triggers
CREATE TRIGGER trigger_calculate_cleaning_vat
    BEFORE INSERT OR UPDATE ON cleaning_jobs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_cleaning_vat();

CREATE TRIGGER trigger_calculate_laundry_vat
    BEFORE INSERT OR UPDATE ON laundry_orders_new
    FOR EACH ROW
    EXECUTE FUNCTION calculate_laundry_vat();

-- ===========================================
-- BACKFILL EXISTING RECORDS
-- ===========================================

-- Backfill cleaning jobs (assume total_cost already includes VAT at 23%)
UPDATE cleaning_jobs
SET
    vat_rate = 23.00,
    subtotal_before_vat = ROUND(total_cost / 1.23, 2),
    vat_amount = ROUND(total_cost - (total_cost / 1.23), 2),
    total_with_vat = total_cost
WHERE vat_amount IS NULL OR vat_amount = 0;

-- Backfill laundry orders (assume total_price already includes VAT at 23%)
UPDATE laundry_orders_new
SET
    vat_rate = 23.00,
    subtotal_before_vat = ROUND(total_price / 1.23, 2),
    vat_amount = ROUND(total_price - (total_price / 1.23), 2),
    total_with_vat = total_price
WHERE vat_amount IS NULL OR vat_amount = 0;

COMMIT;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check cleaning jobs VAT calculation
SELECT
    id,
    subtotal_before_vat,
    vat_rate,
    vat_amount,
    total_with_vat,
    total_cost,
    (total_with_vat = total_cost) as totals_match
FROM cleaning_jobs
LIMIT 5;

-- Check laundry orders VAT calculation
SELECT
    id,
    subtotal_before_vat,
    vat_rate,
    vat_amount,
    total_with_vat,
    total_price,
    (total_with_vat = total_price) as totals_match
FROM laundry_orders_new
LIMIT 5;
```

**Execution:**
```bash
# Apply migration
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_add_vat_fields.sql

# Verify migration
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d cleaning_jobs" | grep -E "(vat|subtotal)"
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d laundry_orders_new" | grep -E "(vat|subtotal)"
```

### Step 2: Tax Report API Endpoints

**File:** Create `routes/reports.js`

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');

// ============================================
// QUARTERLY TAX REPORT
// ============================================
// GET /api/reports/tax/quarterly?year=2025&quarter=1
router.get('/tax/quarterly', requireFinanceAccess, async (req, res) => {
    try {
        const { year, quarter } = req.query;

        if (!year || !quarter) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: year and quarter',
                code: 'INVALID_PARAMETERS',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Validate quarter (1-4)
        if (quarter < 1 || quarter > 4) {
            return res.status(400).json({
                success: false,
                error: 'Quarter must be between 1 and 4',
                code: 'INVALID_QUARTER',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Calculate date range for quarter
        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

        // Cleaning jobs VAT summary
        const cleaningVAT = await pool.query(`
            SELECT
                COUNT(*) as transaction_count,
                SUM(subtotal_before_vat) as total_subtotal,
                SUM(vat_amount) as total_vat,
                SUM(total_with_vat) as total_with_vat,
                AVG(vat_rate) as avg_vat_rate
            FROM cleaning_jobs
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        // Laundry orders VAT summary
        const laundryVAT = await pool.query(`
            SELECT
                COUNT(*) as transaction_count,
                SUM(subtotal_before_vat) as total_subtotal,
                SUM(vat_amount) as total_vat,
                SUM(total_with_vat) as total_with_vat,
                AVG(vat_rate) as avg_vat_rate
            FROM laundry_orders_new
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        const cleaningData = cleaningVAT.rows[0];
        const laundryData = laundryVAT.rows[0];

        // Combined totals
        const totalSubtotal = (parseFloat(cleaningData.total_subtotal) || 0) +
                               (parseFloat(laundryData.total_subtotal) || 0);
        const totalVAT = (parseFloat(cleaningData.total_vat) || 0) +
                         (parseFloat(laundryData.total_vat) || 0);
        const totalWithVAT = (parseFloat(cleaningData.total_with_vat) || 0) +
                             (parseFloat(laundryData.total_with_vat) || 0);

        res.json({
            success: true,
            data: {
                period: {
                    year: parseInt(year),
                    quarter: parseInt(quarter),
                    startDate,
                    endDate
                },
                summary: {
                    totalSubtotal: parseFloat(totalSubtotal.toFixed(2)),
                    totalVAT: parseFloat(totalVAT.toFixed(2)),
                    totalWithVAT: parseFloat(totalWithVAT.toFixed(2)),
                    vatRate: 23.00
                },
                breakdown: {
                    cleaning: {
                        transactionCount: parseInt(cleaningData.transaction_count),
                        subtotal: parseFloat((cleaningData.total_subtotal || 0).toFixed(2)),
                        vat: parseFloat((cleaningData.total_vat || 0).toFixed(2)),
                        totalWithVAT: parseFloat((cleaningData.total_with_vat || 0).toFixed(2))
                    },
                    laundry: {
                        transactionCount: parseInt(laundryData.transaction_count),
                        subtotal: parseFloat((laundryData.total_subtotal || 0).toFixed(2)),
                        vat: parseFloat((laundryData.total_vat || 0).toFixed(2)),
                        totalWithVAT: parseFloat((laundryData.total_with_vat || 0).toFixed(2))
                    }
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching quarterly tax report:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate quarterly tax report',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// ============================================
// ANNUAL TAX REPORT
// ============================================
// GET /api/reports/tax/annual?year=2025
router.get('/tax/annual', requireFinanceAccess, async (req, res) => {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameter: year',
                code: 'INVALID_PARAMETERS',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Get quarterly breakdown
        const quarters = [];
        for (let q = 1; q <= 4; q++) {
            const startMonth = (q - 1) * 3 + 1;
            const endMonth = startMonth + 2;
            const qStartDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
            const qEndDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

            const cleaningQ = await pool.query(`
                SELECT
                    SUM(subtotal_before_vat) as subtotal,
                    SUM(vat_amount) as vat,
                    SUM(total_with_vat) as total
                FROM cleaning_jobs
                WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                    AND status != 'cancelled'
            `, [qStartDate, qEndDate]);

            const laundryQ = await pool.query(`
                SELECT
                    SUM(subtotal_before_vat) as subtotal,
                    SUM(vat_amount) as vat,
                    SUM(total_with_vat) as total
                FROM laundry_orders_new
                WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                    AND status != 'cancelled'
            `, [qStartDate, qEndDate]);

            const qTotalSubtotal = (parseFloat(cleaningQ.rows[0].subtotal) || 0) +
                                    (parseFloat(laundryQ.rows[0].subtotal) || 0);
            const qTotalVAT = (parseFloat(cleaningQ.rows[0].vat) || 0) +
                              (parseFloat(laundryQ.rows[0].vat) || 0);
            const qTotalWithVAT = (parseFloat(cleaningQ.rows[0].total) || 0) +
                                   (parseFloat(laundryQ.rows[0].total) || 0);

            quarters.push({
                quarter: q,
                subtotal: parseFloat(qTotalSubtotal.toFixed(2)),
                vat: parseFloat(qTotalVAT.toFixed(2)),
                totalWithVAT: parseFloat(qTotalWithVAT.toFixed(2))
            });
        }

        // Annual totals
        const annualSubtotal = quarters.reduce((sum, q) => sum + q.subtotal, 0);
        const annualVAT = quarters.reduce((sum, q) => sum + q.vat, 0);
        const annualTotal = quarters.reduce((sum, q) => sum + q.totalWithVAT, 0);

        res.json({
            success: true,
            data: {
                year: parseInt(year),
                summary: {
                    totalSubtotal: parseFloat(annualSubtotal.toFixed(2)),
                    totalVAT: parseFloat(annualVAT.toFixed(2)),
                    totalWithVAT: parseFloat(annualTotal.toFixed(2)),
                    vatRate: 23.00
                },
                quarterlyBreakdown: quarters
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching annual tax report:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate annual tax report',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// ============================================
// DASHBOARD TAX SUMMARY (Current Quarter)
// ============================================
// GET /api/dashboard/tax-summary
router.get('/tax-summary', requireFinanceAccess, async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-12
        const quarter = Math.ceil(month / 3);

        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

        // Get current quarter VAT
        const cleaningVAT = await pool.query(`
            SELECT
                SUM(subtotal_before_vat) as subtotal,
                SUM(vat_amount) as vat,
                SUM(total_with_vat) as total
            FROM cleaning_jobs
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        const laundryVAT = await pool.query(`
            SELECT
                SUM(subtotal_before_vat) as subtotal,
                SUM(vat_amount) as vat,
                SUM(total_with_vat) as total
            FROM laundry_orders_new
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2
                AND status != 'cancelled'
        `, [startDate, endDate]);

        const totalSubtotal = (parseFloat(cleaningVAT.rows[0].subtotal) || 0) +
                               (parseFloat(laundryVAT.rows[0].subtotal) || 0);
        const totalVAT = (parseFloat(cleaningVAT.rows[0].vat) || 0) +
                         (parseFloat(laundryVAT.rows[0].vat) || 0);
        const totalWithVAT = (parseFloat(cleaningVAT.rows[0].total) || 0) +
                             (parseFloat(laundryVAT.rows[0].total) || 0);

        res.json({
            success: true,
            data: {
                currentPeriod: {
                    year,
                    quarter,
                    startDate,
                    endDate
                },
                vatSummary: {
                    subtotal: parseFloat(totalSubtotal.toFixed(2)),
                    vat: parseFloat(totalVAT.toFixed(2)),
                    totalWithVAT: parseFloat(totalWithVAT.toFixed(2)),
                    vatRate: 23.00
                },
                breakdown: {
                    cleaning: parseFloat((cleaningVAT.rows[0].vat || 0).toFixed(2)),
                    laundry: parseFloat((laundryVAT.rows[0].vat || 0).toFixed(2))
                }
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching tax summary:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tax summary',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

module.exports = router;
```

**Register routes in `server.js`:**
```javascript
// Add after existing route registrations
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', reportsRoutes); // For /api/dashboard/tax-summary
```

### Step 3: Frontend Tax Summary Dashboard Widget

**File:** Create `client/src/components/dashboard/TaxSummary.jsx`

```jsx
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
```

**Update:** `client/src/pages/admin/Dashboard.jsx`

```jsx
// Add import
import TaxSummary from '../../components/dashboard/TaxSummary';

// Inside the component, add TaxSummary widget in the grid layout
// (Add this after existing dashboard cards)

{/* Tax Summary - Admin/Master Only */}
{(userType === 'master' || userType === 'admin') && (
    <div className="lg:col-span-1">
        <TaxSummary />
    </div>
)}
```

### Step 4: Validation

```bash
# 1. Apply database migration
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_add_vat_fields.sql

# 2. Verify VAT fields exist
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'cleaning_jobs' AND column_name LIKE '%vat%';"

# 3. Verify backfill (check a few records)
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "
SELECT id, subtotal_before_vat, vat_amount, total_with_vat, total_cost
FROM cleaning_jobs LIMIT 5;"

# 4. Test tax report endpoints
# Quarterly report
curl -s -H "Cookie: connect.sid=..." \
  "http://localhost:3000/api/reports/tax/quarterly?year=2025&quarter=1" | jq .

# Annual report
curl -s -H "Cookie: connect.sid=..." \
  "http://localhost:3000/api/reports/tax/annual?year=2025" | jq .

# Dashboard tax summary
curl -s -H "Cookie: connect.sid=..." \
  "http://localhost:3000/api/dashboard/tax-summary" | jq .

# 5. Run E2E tests (ensure no regressions)
npm run test:e2e

# Expected: ≥41/47 passing (87.2% baseline maintained)

# 6. Manual UI test
# - Login as admin/master
# - Navigate to dashboard
# - Verify tax summary widget displays
# - Check values match database queries
```

---

## (iv) ARTIFACTS

### Database Migration
- **File:** `migrations/20251108_add_vat_fields.sql`
- **Purpose:** Schema changes, triggers, backfill

### Backend Code
- **File:** `routes/reports.js`
- **Endpoints:**
  - GET `/api/reports/tax/quarterly`
  - GET `/api/reports/tax/annual`
  - GET `/api/dashboard/tax-summary`

### Frontend Components
- **File:** `client/src/components/dashboard/TaxSummary.jsx`
- **Purpose:** Dashboard widget for tax overview

### Test Artifacts
- **File:** `test-results/tax-management-validation.log`
- **Purpose:** E2E test results post-implementation

### Validation Scripts
- **File:** `scripts/validate-vat-calculation.sql`
- **Purpose:** Verify VAT calculations are correct

---

## (v) DOCS AUTO-UPDATE SET

### docs/progress.md
Add to 2025-11-08 section:
```markdown
- ✅ **Tax Management Implementation** ([WO-20251108-tax-management](../handoff/WO-20251108-tax-management.md)):
  - Added VAT fields to cleaning_jobs and laundry_orders_new tables
  - Implemented automatic VAT calculation (23% Portuguese IVA)
  - Backfilled historical records with calculated VAT
  - Created quarterly/annual tax report API endpoints
  - Added dashboard tax summary widget for Admin/Master
  - All existing jobs/orders now have proper tax breakdown
```

### docs/decisions.md
Add entry:
```markdown
## 2025-11-08T04:15:00Z - Portuguese VAT Implementation (23% IVA)

### Context
Business operates in Portugal, requires tax compliance and reporting:
- Quarterly IVA reporting to government
- Invoice generation needs VAT breakdown
- Dashboard should show tax overview

### Options
1. **Add VAT fields to existing tables** (cleaning_jobs, laundry_orders_new) ✅
2. **Create separate VAT_transactions table**
3. **Calculate VAT on-the-fly in queries**

### Decision
✅ **Option 1: Add VAT fields to existing tables**

Rationale:
- Direct relationship: each job/order has exactly one VAT amount
- Simpler queries (no joins needed)
- Triggers handle automatic calculation (no code duplication)
- Historical backfill preserves existing data
- Backward compatibility: keep total_cost/total_price fields

**Schema Design:**
```sql
subtotal_before_vat NUMERIC(10,2)  -- Base amount
vat_rate NUMERIC(5,2) DEFAULT 23.00 -- Portuguese IVA
vat_amount NUMERIC(10,2)            -- Calculated VAT
total_with_vat NUMERIC(10,2)        -- Final total
```

### Consequences
**Positive:**
- Automatic VAT calculation via database triggers
- No application code changes needed for calculations
- Easy quarterly/annual reporting queries
- Future-proof: can add multiple VAT rates (reduced, exempt)

**Negative:**
- Redundant data (total_cost == total_with_vat for now)
- Migration required for existing records

**Follow-up:**
- Document VAT rate changes process (if Portugal changes rates)
- Consider tax exemption handling (future)
- Multi-country support (if expanding outside Portugal)
```

### docs/bugs.md
No bugs - this is a new feature. No entry needed unless issues discovered during testing.

### docs/architecture.md
Add to Financial Management section:
```markdown
### Tax/VAT Tracking

**Database Schema:**
- Both `cleaning_jobs` and `laundry_orders_new` have VAT fields:
  - `subtotal_before_vat` - Base amount before tax
  - `vat_rate` - Tax percentage (default 23% for Portugal)
  - `vat_amount` - Calculated tax amount
  - `total_with_vat` - Final total including tax

**Automatic Calculation:**
- Database triggers: `trigger_calculate_cleaning_vat`, `trigger_calculate_laundry_vat`
- Fires on INSERT/UPDATE
- Formula: `vat_amount = subtotal * (vat_rate / 100)`

**Tax Reporting Endpoints:**
- `/api/reports/tax/quarterly?year=2025&quarter=1` - Quarterly IVA report
- `/api/reports/tax/annual?year=2025` - Annual tax summary
- `/api/dashboard/tax-summary` - Current quarter overview

**Access Control:**
- Tax reports: `requireFinanceAccess` (Admin/Master only)
- Dashboard widget: Conditional rendering for Admin/Master
```

---

## (vi) PR PACKAGE

### Branch Name
```bash
git checkout -b feat/tax-vat-management
```

### Commit Messages

```bash
# Commit 1: Database migration
git add migrations/20251108_add_vat_fields.sql
git commit -m "feat(tax): add VAT fields to cleaning_jobs and laundry_orders_new

- Add subtotal_before_vat, vat_rate, vat_amount, total_with_vat columns
- Create automatic VAT calculation triggers (23% Portuguese IVA)
- Backfill historical records with calculated VAT
- Maintain backward compatibility with total_cost/total_price fields

Refs: WO-20251108-tax-management"

# Commit 2: Tax report API
git add routes/reports.js server.js
git commit -m "feat(tax): add quarterly/annual tax report API endpoints

- GET /api/reports/tax/quarterly - Quarterly IVA summary
- GET /api/reports/tax/annual - Annual tax report with quarterly breakdown
- GET /api/dashboard/tax-summary - Current quarter tax overview
- Finance access required (Admin/Master only)
- Standardized response envelope format

Refs: WO-20251108-tax-management"

# Commit 3: Frontend tax widget
git add client/src/components/dashboard/TaxSummary.jsx \
        client/src/pages/admin/Dashboard.jsx
git commit -m "feat(tax): add tax summary dashboard widget for Admin/Master

- Display current quarter VAT collected
- Show revenue breakdown (excl/incl VAT)
- Service breakdown (cleaning vs laundry)
- Conditional rendering for Admin/Master roles only

Refs: WO-20251108-tax-management"

# Commit 4: Documentation
git add docs/progress.md docs/decisions.md docs/architecture.md
git commit -m "docs: record tax/VAT management implementation

- Added tax tracking decision to decisions.md
- Updated architecture.md with VAT schema and endpoints
- Recorded implementation in progress.md

Refs: WO-20251108-tax-management"
```

### PR Title & Description

```markdown
feat(tax): comprehensive VAT/IVA tracking and reporting (Portuguese compliance)

## Summary
Implements complete tax management system for Portuguese IVA (23% VAT) compliance. Adds VAT fields to both cleaning jobs and laundry orders, automatic calculation via database triggers, and quarterly/annual tax reporting.

## Changes

### Database (Migration)
- ✅ Added VAT fields to `cleaning_jobs` and `laundry_orders_new`:
  - `subtotal_before_vat` - Base amount before tax
  - `vat_rate` - Tax percentage (default 23%)
  - `vat_amount` - Calculated VAT
  - `total_with_vat` - Final total including VAT
- ✅ Database triggers for automatic VAT calculation
- ✅ Backfilled historical records (reverse calculation from existing totals)

### Backend (API)
- ✅ `/api/reports/tax/quarterly` - Quarterly IVA report (Admin/Master only)
- ✅ `/api/reports/tax/annual` - Annual tax summary with quarterly breakdown
- ✅ `/api/dashboard/tax-summary` - Current quarter tax overview
- ✅ Finance access control (`requireFinanceAccess` middleware)

### Frontend (Dashboard Widget)
- ✅ `TaxSummary.jsx` component - Current quarter VAT display
- ✅ Admin/Master only visibility (conditional rendering)
- ✅ Service breakdown (cleaning vs laundry VAT)

## Business Value
- **Tax Compliance**: Quarterly IVA reporting ready for Portuguese tax authorities
- **Financial Transparency**: Clear VAT breakdown on all transactions
- **Invoice Preparation**: VAT amounts available for invoice generation (next WO)
- **Audit Trail**: Historical VAT data preserved with backfill

## Testing
- [ ] Database migration applied successfully
- [ ] VAT triggers calculate correctly (cleaning + laundry)
- [ ] Historical records backfilled with accurate VAT
- [ ] Tax report endpoints return correct totals
- [ ] Dashboard widget displays for Admin/Master (not Worker/Client)
- [ ] E2E tests pass at ≥87.2% (no regressions)

## Migration Notes
**Run migration before deploying:**
```bash
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_add_vat_fields.sql
```

## Refs
- Work Order: [WO-20251108-tax-management](../handoff/WO-20251108-tax-management.md)
- User Priority: #2 - "the jobs, they have taxes and right now the app doesnt have that info"
```

---

## (vii) IMPLEMENTER HANDOFF

### For Developer Agent

**Task:** Implement complete tax/VAT tracking for Portuguese IVA compliance (23% rate).

**Execution Sequence:**

1. **Database Migration (10 min)**
   ```bash
   # Create migration file
   nano migrations/20251108_add_vat_fields.sql
   # Copy SQL from Step 1 above

   # Apply migration
   docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_add_vat_fields.sql

   # Verify
   docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d cleaning_jobs" | grep vat
   ```

2. **Backend API (60 min)**
   ```bash
   # Create reports routes
   nano routes/reports.js
   # Copy code from Step 2 above

   # Register in server.js
   nano server.js
   # Add: const reportsRoutes = require('./routes/reports');
   #      app.use('/api/reports', reportsRoutes);
   #      app.use('/api/dashboard', reportsRoutes);

   # Restart server
   npm run server
   ```

3. **Frontend Widget (45 min)**
   ```bash
   # Create tax summary component
   nano client/src/components/dashboard/TaxSummary.jsx
   # Copy code from Step 3 above

   # Update dashboard
   nano client/src/pages/admin/Dashboard.jsx
   # Add TaxSummary import and component (Admin/Master only)

   # Restart client
   cd client && npm start
   ```

4. **Validation (15 min)**
   ```bash
   # Test endpoints (use admin cookie from browser DevTools)
   curl -H "Cookie: connect.sid=..." \
     "http://localhost:3000/api/reports/tax/quarterly?year=2025&quarter=1" | jq .

   # Run E2E tests
   npm run test:e2e
   # Expect: ≥41/47 passing (no regressions)
   ```

5. **Documentation (10 min)**
   ```bash
   # Update docs
   nano docs/progress.md docs/decisions.md docs/architecture.md
   # Copy entries from section (v) above

   # Commit
   git add -A
   git commit -m "feat(tax): comprehensive VAT/IVA tracking and reporting"
   ```

**Important Notes:**
- VAT rate is hardcoded to 23% (Portuguese standard rate)
- Backfill assumes existing totals already include VAT (reverse calculation)
- Finance access required for all tax endpoints (Admin/Master only)
- Widget only renders for Admin/Master roles
- Keep `total_cost` and `total_price` fields for backward compatibility

**Expected Outcome:**
- All cleaning jobs and laundry orders have VAT breakdown
- Quarterly/annual tax reports accessible via API
- Dashboard displays current quarter VAT summary
- No regressions in existing functionality

### For Tester Agent

**Scenarios to Validate:**

1. **Database VAT Calculation (Cleaning Jobs)**
   ```sql
   -- Create test cleaning job
   INSERT INTO cleaning_jobs (
       client_id, job_type, property_address, address_line1, city,
       scheduled_date, scheduled_time, estimated_hours, hourly_rate
   ) VALUES (
       1, 'house', '123 Test St', '123 Test St', 'Lisboa',
       '2025-11-10', '10:00', 3.5, 15.00
   );

   -- Verify VAT calculation
   SELECT
       id,
       hourly_rate,
       estimated_hours,
       subtotal_before_vat,  -- Should be 52.50 (15 * 3.5)
       vat_rate,              -- Should be 23.00
       vat_amount,            -- Should be 12.08 (52.50 * 0.23)
       total_with_vat,        -- Should be 64.58
       total_cost             -- Should match total_with_vat
   FROM cleaning_jobs
   ORDER BY id DESC LIMIT 1;
   ```
   **Expected:**
   - `subtotal_before_vat = 52.50`
   - `vat_rate = 23.00`
   - `vat_amount = 12.08`
   - `total_with_vat = 64.58`
   - `total_cost = total_with_vat`

2. **Database VAT Calculation (Laundry Orders)**
   ```sql
   -- Create test laundry order
   INSERT INTO laundry_orders_new (
       client_id, order_number, order_type, total_weight_kg, price_per_kg
   ) VALUES (
       1, 'LO-TEST-20251108-001', 'bulk_kg', 5.00, 3.50
   );

   -- Verify VAT calculation
   SELECT
       id,
       order_number,
       total_weight_kg,
       price_per_kg,
       base_price,            -- Should be 17.50 (5 * 3.5)
       subtotal_before_vat,   -- Should be 17.50
       vat_rate,              -- Should be 23.00
       vat_amount,            -- Should be 4.03 (17.50 * 0.23)
       total_with_vat,        -- Should be 21.53
       total_price            -- Should match total_with_vat
   FROM laundry_orders_new
   WHERE order_number = 'LO-TEST-20251108-001';
   ```
   **Expected:**
   - `subtotal_before_vat = 17.50`
   - `vat_amount = 4.03`
   - `total_with_vat = 21.53`

3. **API Endpoint: Quarterly Tax Report**
   ```bash
   # Login as admin, get session cookie
   # Then test endpoint
   curl -s -H "Cookie: connect.sid=..." \
     "http://localhost:3000/api/reports/tax/quarterly?year=2025&quarter=1" | jq .
   ```
   **Expected Response:**
   ```json
   {
     "success": true,
     "data": {
       "period": {
         "year": 2025,
         "quarter": 1,
         "startDate": "2025-01-01",
         "endDate": "2025-03-31"
       },
       "summary": {
         "totalSubtotal": 1250.75,
         "totalVAT": 287.67,
         "totalWithVAT": 1538.42,
         "vatRate": 23.00
       },
       "breakdown": {
         "cleaning": {...},
         "laundry": {...}
       }
     },
     "_meta": {
       "correlationId": "req_...",
       "timestamp": "..."
     }
   }
   ```

4. **API Endpoint: Annual Tax Report**
   ```bash
   curl -s -H "Cookie: connect.sid=..." \
     "http://localhost:3000/api/reports/tax/annual?year=2025" | jq .
   ```
   **Expected:**
   - Array of 4 quarters with subtotal/vat/total
   - Annual summary totals

5. **API Endpoint: Dashboard Tax Summary**
   ```bash
   curl -s -H "Cookie: connect.sid=..." \
     "http://localhost:3000/api/dashboard/tax-summary" | jq .
   ```
   **Expected:**
   - Current quarter/year detected automatically
   - VAT summary for current period

6. **RBAC: Worker Cannot Access Tax Reports**
   ```bash
   # Login as worker1, get session cookie
   curl -s -H "Cookie: connect.sid=..." \
     "http://localhost:3000/api/reports/tax/quarterly?year=2025&quarter=1"
   ```
   **Expected:**
   - HTTP 403 Forbidden
   - Error: "Finance access denied"

7. **Frontend: Tax Summary Widget (Admin)**
   - Login as admin
   - Navigate to Dashboard
   - Verify Tax Summary widget displays
   - Check values match API response
   - Verify period shows current quarter/year

8. **Frontend: Tax Summary Hidden for Workers**
   - Login as worker1
   - Navigate to Dashboard (if accessible)
   - Verify Tax Summary widget does NOT display

9. **Historical Data Backfill Verification**
   ```sql
   -- Check all existing records have VAT
   SELECT
       COUNT(*) as total_jobs,
       COUNT(vat_amount) as jobs_with_vat,
       AVG(vat_rate) as avg_vat_rate
   FROM cleaning_jobs;

   -- Should match (all records have VAT)
   ```

10. **E2E Regression Test**
    ```bash
    npm run test:e2e
    ```
    **Expected:**
    - Pass rate ≥87.2% (41/47 tests minimum)
    - No new failures in existing test suites

**Validation Checklist:**
- [ ] VAT auto-calculates on new cleaning jobs
- [ ] VAT auto-calculates on new laundry orders
- [ ] Historical records have VAT populated
- [ ] Quarterly tax report API works (Admin/Master)
- [ ] Annual tax report API works (Admin/Master)
- [ ] Dashboard tax summary API works (Admin/Master)
- [ ] Tax endpoints blocked for Worker role (403)
- [ ] Tax summary widget displays for Admin
- [ ] Tax summary widget hidden for Worker
- [ ] E2E tests pass with no regressions

---

**End of Work Order**
