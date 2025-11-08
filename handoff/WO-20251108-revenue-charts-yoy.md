# Work Order: WO-20251108-revenue-charts-yoy

**Created:** 2025-11-08 04:15 UTC
**Priority:** P0 (User Priority #1)
**Type:** Feature - Revenue Analytics
**Estimated Duration:** 20-24 hours

---

## (i) HEADER

### Objective
Implement automatic monthly revenue charts with year-over-year comparison to enable business owners to track revenue trends and make data-driven decisions.

### Context
- **User Request:** "we need charts of monthly revenue and compared with last year (it has to be auto) the revenue chart has to be automatic"
- **Current State:** Basic dashboard stats exist (`/api/dashboard/stats`) but NO charts, NO time-series data, NO year-over-year comparison
- **Business Need:** Track revenue growth, identify seasonal trends, compare performance across years

### Scope
- **In Scope:** Monthly revenue aggregation, year-over-year comparison, automated chart updates, service breakdown (laundry vs cleaning)
- **Out of Scope:** Profit calculation (revenue - costs), client ranking, predictive analytics

---

## (ii) ACCEPTANCE CRITERIA

- [ ] API endpoint returns monthly revenue data for any year (2024, 2025, etc.)
- [ ] Year-over-year comparison endpoint compares two years side-by-side
- [ ] Revenue broken down by service type (laundry vs cleaning)
- [ ] Charts automatically update when new payments are recorded
- [ ] Frontend displays interactive charts using Recharts library
- [ ] Admin/Master can view charts (workers cannot - finance restriction)
- [ ] Chart shows: total revenue, transaction count, average transaction value
- [ ] Year selector allows viewing historical data
- [ ] Charts render on `/dashboard` page for admin/master users
- [ ] No regressions in existing finance endpoints

---

## (iii) TERMINAL-FIRST PLAN

### Step 1: Install Chart Library

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/Lavandaria/client
npm install recharts --save
cd ..
```

### Step 2: Create Database View for Fast Aggregation

**File:** Create migration `migrations/008_monthly_revenue_view.sql`

```sql
-- Monthly Revenue Materialized View for Fast Queries
CREATE MATERIALIZED VIEW monthly_revenue_summary AS
SELECT
    DATE_TRUNC('month', payment_date)::DATE as month,
    EXTRACT(YEAR FROM payment_date)::INTEGER as year,
    EXTRACT(MONTH FROM payment_date)::INTEGER as month_number,
    SUM(amount) as total_revenue,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_transaction_value,
    'cleaning' as service_type
FROM payments_cleaning
WHERE payment_date IS NOT NULL
GROUP BY DATE_TRUNC('month', payment_date), EXTRACT(YEAR FROM payment_date), EXTRACT(MONTH FROM payment_date)

UNION ALL

SELECT
    DATE_TRUNC('month', payment_date)::DATE as month,
    EXTRACT(YEAR FROM payment_date)::INTEGER as year,
    EXTRACT(MONTH FROM payment_date)::INTEGER as month_number,
    SUM(amount) as total_revenue,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_transaction_value,
    'laundry' as service_type
FROM payments_laundry
WHERE payment_date IS NOT NULL
GROUP BY DATE_TRUNC('month', payment_date), EXTRACT(YEAR FROM payment_date), EXTRACT(MONTH FROM payment_date);

-- Index for fast querying
CREATE INDEX idx_monthly_revenue_year_month ON monthly_revenue_summary(year, month_number, service_type);

-- Function to refresh materialized view (call after new payments)
CREATE OR REPLACE FUNCTION refresh_revenue_summary()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_summary;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-refresh view when payments added
CREATE TRIGGER refresh_revenue_on_cleaning_payment
AFTER INSERT OR UPDATE OR DELETE ON payments_cleaning
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_revenue_summary();

CREATE TRIGGER refresh_revenue_on_laundry_payment
AFTER INSERT OR UPDATE OR DELETE ON payments_laundry
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_revenue_summary();
```

**Run Migration:**
```bash
docker exec lavandaria-db psql -U lavandaria -d lavandaria -f migrations/008_monthly_revenue_view.sql
```

### Step 3: Create Revenue API Endpoints

**File:** `routes/revenue.js` (NEW FILE)

```javascript
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { requireFinanceAccess } = require('../middleware/permissions');

/**
 * GET /api/revenue/monthly?year=2025
 * Get monthly revenue breakdown for a specific year
 */
router.get('/monthly', requireFinanceAccess, async (req, res) => {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    try {
        const result = await pool.query(`
            SELECT
                month,
                year,
                month_number,
                service_type,
                total_revenue,
                transaction_count,
                ROUND(avg_transaction_value, 2) as avg_transaction_value
            FROM monthly_revenue_summary
            WHERE year = $1
            ORDER BY month_number, service_type
        `, [targetYear]);

        // Group by month for easier frontend consumption
        const monthlyData = {};
        result.rows.forEach(row => {
            const key = row.month_number;
            if (!monthlyData[key]) {
                monthlyData[key] = {
                    month: row.month,
                    month_number: row.month_number,
                    year: row.year,
                    cleaning_revenue: 0,
                    laundry_revenue: 0,
                    total_revenue: 0,
                    cleaning_transactions: 0,
                    laundry_transactions: 0,
                    total_transactions: 0
                };
            }

            if (row.service_type === 'cleaning') {
                monthlyData[key].cleaning_revenue = parseFloat(row.total_revenue);
                monthlyData[key].cleaning_transactions = row.transaction_count;
            } else {
                monthlyData[key].laundry_revenue = parseFloat(row.total_revenue);
                monthlyData[key].laundry_transactions = row.transaction_count;
            }

            monthlyData[key].total_revenue =
                monthlyData[key].cleaning_revenue + monthlyData[key].laundry_revenue;
            monthlyData[key].total_transactions =
                monthlyData[key].cleaning_transactions + monthlyData[key].laundry_transactions;
        });

        // Convert to array and fill missing months with zeros
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chartData = [];

        for (let i = 1; i <= 12; i++) {
            chartData.push(monthlyData[i] || {
                month_number: i,
                month_name: monthNames[i-1],
                year: targetYear,
                cleaning_revenue: 0,
                laundry_revenue: 0,
                total_revenue: 0,
                cleaning_transactions: 0,
                laundry_transactions: 0,
                total_transactions: 0
            });
        }

        res.json({
            success: true,
            data: {
                year: targetYear,
                monthly_data: chartData
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`❌ [REVENUE] Monthly revenue query failed [${req.correlationId}]:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monthly revenue',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

/**
 * GET /api/revenue/year-comparison?year1=2024&year2=2025
 * Compare revenue between two years
 */
router.get('/year-comparison', requireFinanceAccess, async (req, res) => {
    const { year1, year2 } = req.query;
    const currentYear = new Date().getFullYear();
    const targetYear1 = year1 ? parseInt(year1) : currentYear - 1;
    const targetYear2 = year2 ? parseInt(year2) : currentYear;

    try {
        const result = await pool.query(`
            SELECT
                year,
                month_number,
                SUM(total_revenue) as total_revenue,
                SUM(transaction_count) as transaction_count
            FROM monthly_revenue_summary
            WHERE year IN ($1, $2)
            GROUP BY year, month_number
            ORDER BY month_number, year
        `, [targetYear1, targetYear2]);

        // Format for year-over-year comparison
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const comparisonData = [];

        for (let i = 1; i <= 12; i++) {
            const year1Data = result.rows.find(r => r.year === targetYear1 && r.month_number === i);
            const year2Data = result.rows.find(r => r.year === targetYear2 && r.month_number === i);

            const year1Revenue = year1Data ? parseFloat(year1Data.total_revenue) : 0;
            const year2Revenue = year2Data ? parseFloat(year2Data.total_revenue) : 0;
            const growthPercent = year1Revenue > 0
                ? ((year2Revenue - year1Revenue) / year1Revenue * 100).toFixed(1)
                : 0;

            comparisonData.push({
                month_number: i,
                month_name: monthNames[i-1],
                [`year_${targetYear1}`]: year1Revenue,
                [`year_${targetYear2}`]: year2Revenue,
                growth_percent: parseFloat(growthPercent)
            });
        }

        res.json({
            success: true,
            data: {
                year1: targetYear1,
                year2: targetYear2,
                comparison_data: comparisonData
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`❌ [REVENUE] Year comparison failed [${req.correlationId}]:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to compare years',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

/**
 * GET /api/revenue/summary
 * Get overall revenue summary (all-time, YTD, current month)
 */
router.get('/summary', requireFinanceAccess, async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        const result = await pool.query(`
            SELECT
                SUM(CASE WHEN year = $1 THEN total_revenue ELSE 0 END) as ytd_revenue,
                SUM(CASE WHEN year = $1 AND month_number = $2 THEN total_revenue ELSE 0 END) as current_month_revenue,
                SUM(total_revenue) as all_time_revenue,
                SUM(CASE WHEN year = $1 THEN transaction_count ELSE 0 END) as ytd_transactions,
                SUM(transaction_count) as all_time_transactions
            FROM monthly_revenue_summary
        `, [currentYear, currentMonth]);

        res.json({
            success: true,
            data: {
                current_year: currentYear,
                current_month: currentMonth,
                ytd_revenue: parseFloat(result.rows[0].ytd_revenue) || 0,
                current_month_revenue: parseFloat(result.rows[0].current_month_revenue) || 0,
                all_time_revenue: parseFloat(result.rows[0].all_time_revenue) || 0,
                ytd_transactions: result.rows[0].ytd_transactions || 0,
                all_time_transactions: result.rows[0].all_time_transactions || 0
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error(`❌ [REVENUE] Summary query failed [${req.correlationId}]:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch revenue summary',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

module.exports = router;
```

**Register Route in `server.js`:**
```javascript
// Add after other route registrations
const revenueRoutes = require('./routes/revenue');
app.use('/api/revenue', revenueRoutes);
```

### Step 4: Create Frontend Chart Components

**File:** `client/src/components/charts/MonthlyRevenueChart.jsx` (NEW)

```jsx
import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MonthlyRevenueChart = ({ data, year }) => {
    // Format currency for tooltip and axis
    const formatCurrency = (value) => `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`;

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">Monthly Revenue - {year}</h3>

            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month_name" />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip formatter={formatCurrency} />
                    <Legend />
                    <Bar dataKey="cleaning_revenue" fill="#3b82f6" name="Cleaning Revenue" />
                    <Bar dataKey="laundry_revenue" fill="#10b981" name="Laundry Revenue" />
                </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(data.reduce((sum, m) => sum + m.total_revenue, 0))}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">Total Transactions</p>
                    <p className="text-2xl font-bold text-green-600">
                        {data.reduce((sum, m) => sum + m.total_transactions, 0)}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">Avg Transaction</p>
                    <p className="text-2xl font-bold text-purple-600">
                        {formatCurrency(
                            data.reduce((sum, m) => sum + m.total_revenue, 0) /
                            data.reduce((sum, m) => sum + m.total_transactions, 0) || 0
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MonthlyRevenueChart;
```

**File:** `client/src/components/charts/YearOverYearChart.jsx` (NEW)

```jsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const YearOverYearChart = ({ data, year1, year2 }) => {
    const formatCurrency = (value) => `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`;

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-bold mb-4">
                Year-over-Year Comparison: {year1} vs {year2}
            </h3>

            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month_name" />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip formatter={formatCurrency} />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey={`year_${year1}`}
                        stroke="#94a3b8"
                        name={`${year1}`}
                        strokeWidth={2}
                    />
                    <Line
                        type="monotone"
                        dataKey={`year_${year2}`}
                        stroke="#3b82f6"
                        name={`${year2}`}
                        strokeWidth={2}
                    />
                </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-sm text-gray-600">{year1} Total</p>
                    <p className="text-2xl font-bold text-gray-500">
                        {formatCurrency(data.reduce((sum, m) => sum + m[`year_${year1}`], 0))}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">{year2} Total</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(data.reduce((sum, m) => sum + m[`year_${year2}`], 0))}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-600">Growth</p>
                    <p className={`text-2xl font-bold ${
                        data[data.length-1]?.growth_percent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                        {data.reduce((sum, m) => sum + m.growth_percent, 0) / data.length || 0}%
                    </p>
                </div>
            </div>
        </div>
    );
};

export default YearOverYearChart;
```

### Step 5: Add Charts to Dashboard

**File:** `client/src/pages/Dashboard.jsx` (UPDATE - Add charts section for Master/Admin)

```jsx
// Add imports at top
import MonthlyRevenueChart from '../components/charts/MonthlyRevenueChart';
import YearOverYearChart from '../components/charts/YearOverYearChart';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Add inside Dashboard component (for Master/Admin only)
const [revenueData, setRevenueData] = useState(null);
const [comparisonData, setComparisonData] = useState(null);
const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

useEffect(() => {
    if (user.role === 'master' || user.role === 'admin') {
        // Fetch monthly revenue
        axios.get(`/api/revenue/monthly?year=${selectedYear}`)
            .then(res => setRevenueData(res.data.data.monthly_data))
            .catch(err => console.error('Failed to fetch revenue:', err));

        // Fetch year-over-year comparison
        axios.get(`/api/revenue/year-comparison?year1=${selectedYear-1}&year2=${selectedYear}`)
            .then(res => setComparisonData(res.data.data.comparison_data))
            .catch(err => console.error('Failed to fetch comparison:', err));
    }
}, [selectedYear, user.role]);

// Add in render (after existing tabs, before closing div)
{(user.role === 'master' || user.role === 'admin') && (
    <div className="mt-8 space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Revenue Analytics</h2>
            <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 border rounded"
            >
                <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            </select>
        </div>

        {revenueData && <MonthlyRevenueChart data={revenueData} year={selectedYear} />}
        {comparisonData && (
            <YearOverYearChart
                data={comparisonData}
                year1={selectedYear-1}
                year2={selectedYear}
            />
        )}
    </div>
)}
```

### Step 6: Validate

```bash
# Start services
npm run docker:up

# Test API endpoints
curl http://localhost:3000/api/revenue/monthly?year=2025 \
  -H "Cookie: connect.sid=..." # (after admin login)

curl http://localhost:3000/api/revenue/year-comparison?year1=2024&year2=2025 \
  -H "Cookie: connect.sid=..."

# Access dashboard as admin/master
# Navigate to http://localhost:3000/dashboard
# Verify charts appear and update automatically
```

---

## (iv) ARTIFACTS

### Database Migrations
- `migrations/008_monthly_revenue_view.sql` - Materialized view + triggers

### Backend Files
- `routes/revenue.js` (NEW) - Revenue API endpoints
- `server.js` (UPDATE) - Register revenue routes

### Frontend Files
- `client/src/components/charts/MonthlyRevenueChart.jsx` (NEW)
- `client/src/components/charts/YearOverYearChart.jsx` (NEW)
- `client/src/pages/Dashboard.jsx` (UPDATE) - Add charts section
- `client/package.json` (UPDATE) - Add recharts dependency

### Test Scenarios
- Admin logs in → sees revenue charts
- Worker logs in → does NOT see charts (finance restriction)
- Year selector changes → charts update
- New payment added → charts automatically refresh

---

## (v) DOCS AUTO-UPDATE SET

### docs/progress.md
```markdown
- ✅ **Revenue Charts with Year-over-Year** ([WO-20251108-revenue-charts-yoy](../handoff/WO-20251108-revenue-charts-yoy.md)):
  - Created monthly_revenue_summary materialized view
  - Implemented /api/revenue endpoints (monthly, year-comparison, summary)
  - Added Recharts library for visualization
  - Created MonthlyRevenueChart and YearOverYearChart components
  - Integrated charts into admin/master dashboard
  - Auto-refresh on new payments via database triggers
```

### docs/architecture.md
```markdown
## Revenue Analytics

**Materialized View:** `monthly_revenue_summary`
- Aggregates payments by month, year, service type
- Auto-refreshes via triggers on payments_cleaning/payments_laundry
- Indexed on (year, month_number, service_type)

**API Endpoints:**
- `GET /api/revenue/monthly?year=2025` - Monthly breakdown
- `GET /api/revenue/year-comparison?year1=2024&year2=2025` - YoY comparison
- `GET /api/revenue/summary` - Overall stats (YTD, all-time)

**Frontend Charts:**
- MonthlyRevenueChart - Bar chart with cleaning vs laundry breakdown
- YearOverYearChart - Line chart comparing two years
- Automatic updates when new payments added
```

---

## (vi) PR PACKAGE

### Branch Name
```bash
git checkout -b feat/revenue-charts-yoy
```

### Commit Sequence
```bash
# Commit 1: Database
git add migrations/
git commit -m "feat(db): add monthly revenue materialized view with auto-refresh

- Create monthly_revenue_summary view aggregating by month/year/service
- Add triggers to auto-refresh on payments_cleaning/payments_laundry changes
- Index on (year, month_number, service_type) for fast queries

Refs: WO-20251108-revenue-charts-yoy"

# Commit 2: Backend
git add routes/revenue.js server.js
git commit -m "feat(api): add revenue analytics endpoints

- GET /api/revenue/monthly?year=... - Monthly breakdown
- GET /api/revenue/year-comparison?year1=...&year2=... - YoY comparison
- GET /api/revenue/summary - Overall stats
- Finance access restriction (master/admin only)
- Standardized envelope responses

Refs: WO-20251108-revenue-charts-yoy"

# Commit 3: Frontend
git add client/
git commit -m "feat(ui): add revenue charts with year-over-year comparison

- Install recharts library for visualization
- Create MonthlyRevenueChart (bar chart, cleaning vs laundry)
- Create YearOverYearChart (line chart, YoY comparison)
- Integrate charts into admin/master dashboard
- Year selector for historical data viewing
- Auto-update on data changes

Refs: WO-20251108-revenue-charts-yoy"

# Commit 4: Docs
git add docs/
git commit -m "docs: record revenue charts implementation

Refs: WO-20251108-revenue-charts-yoy"
```

### PR Title & Description
```markdown
feat: revenue charts with automatic year-over-year comparison

## Summary
Implements automatic monthly revenue charts with year-over-year comparison for business analytics. Charts update automatically when new payments are recorded.

## Features
- **Monthly Revenue Charts** - Bar charts showing cleaning vs laundry revenue breakdown
- **Year-over-Year Comparison** - Line charts comparing current year vs previous year
- **Automatic Updates** - Database triggers refresh materialized view on new payments
- **Service Breakdown** - Separate tracking for cleaning and laundry services
- **Historical Data** - Year selector to view past performance
- **Finance Restricted** - Only master/admin can view (workers blocked)

## Technical Implementation
- **Database:** Materialized view with automatic refresh triggers
- **Backend:** 3 new API endpoints under `/api/revenue`
- **Frontend:** Recharts library with responsive charts
- **Security:** Finance access restriction via requireFinanceAccess middleware

## Refs
- Work Order: WO-20251108-revenue-charts-yoy
- User Priority #1
```

---

## (vii) IMPLEMENTER HANDOFF

### For Developer Agent

**Task:** Implement automatic revenue charts with year-over-year comparison.

**Execution Order:**
1. Create database migration (`migrations/008_monthly_revenue_view.sql`)
2. Run migration: `docker exec lavandaria-db psql -U lavandaria -d lavandaria -f migrations/008_monthly_revenue_view.sql`
3. Create `routes/revenue.js` with 3 endpoints
4. Register route in `server.js`
5. Install recharts: `cd client && npm install recharts --save`
6. Create chart components (MonthlyRevenueChart, YearOverYearChart)
7. Update Dashboard.jsx to display charts for admin/master

**Security:** All endpoints use `requireFinanceAccess` middleware (workers blocked).

**Testing:**
```bash
# As admin, verify charts appear on dashboard
# Change year selector → charts update
# Add new payment → verify charts refresh
```

### For Tester Agent

**Test Scenarios:**

1. **Admin Chart Access:**
   - Login as admin
   - Navigate to /dashboard
   - Verify revenue charts appear below tabs
   - Verify charts show data for current year

2. **Year Selector:**
   - Change year dropdown to previous year
   - Verify charts update with historical data
   - Change back to current year → verify update

3. **Worker Finance Restriction:**
   - Login as worker
   - Navigate to /dashboard
   - Verify charts DO NOT appear (finance restriction)

4. **Automatic Updates:**
   - As admin, view charts
   - Add new payment via API or UI
   - Refresh dashboard → verify revenue reflects new payment

5. **Year-over-Year Comparison:**
   - Verify YoY chart shows two lines (previous year vs current)
   - Verify growth percentage calculation
   - Check tooltip shows correct currency formatting

**Expected Results:**
- Charts render without errors
- Data updates automatically
- Workers cannot access chart data (403 on API calls)
- Currency formatted as €X,XXX.XX (Portuguese format)

---

**End of Work Order**
