# Work Order: WO-20251108-invoices-notifications

**Created:** 2025-11-08 04:30 UTC
**Priority:** P0 (Launch Blocker)
**Type:** Feature Implementation
**Estimated Duration:** 6-8 hours

---

## (i) HEADER

### Objective
Implement invoice generation (PDF) and automated email notification system to complete the business operation workflow for Lavandaria's dual-business model (laundry + cleaning).

### Context
**Business Critical Gap Identified:**
- User research revealed invoices and notifications are missing but essential for business operations
- Customers expect invoices for tax/expense purposes
- Staff need automated notifications to manage workflow efficiently

**Current State:**
- No invoice generation capability (manual process)
- No automated email notifications (manual phone/SMS only)
- `client_notified_via` field exists but unused (laundry_orders_new)
- `job_notifications` table exists but no implementation

**Business Requirements:**
- **Invoices:** Professional PDF invoices with VAT breakdown, company branding, payment terms
- **Notifications:** Automated emails for status changes (order ready, job completed, payment received, etc.)
- **Portuguese Context:** Invoices must comply with Portuguese tax requirements (NIF, VAT breakdown, legal text)

### Scope
- **In Scope:**
  - PDF invoice generation for cleaning jobs and laundry orders
  - Invoice numbering system (sequential, unique)
  - Email notification system with templates
  - Automated triggers for key status changes
  - Invoice download endpoint (Admin/Client access)
  - Notification preference management

- **Out of Scope:**
  - SMS notifications (future enhancement)
  - Multi-language invoices (Portuguese only for now)
  - Invoice customization UI (use default template)
  - Email marketing campaigns

---

## (ii) ACCEPTANCE CRITERIA

### Invoice Generation
- [ ] Database table `invoices` created with proper foreign keys
- [ ] PDF generation library integrated (pdfkit or similar)
- [ ] Invoice template includes:
  - Company logo and details
  - Client information
  - Invoice number (format: INV-YYYY-MM-####)
  - Date and due date
  - Itemized services
  - Subtotal, VAT breakdown (23%), total
  - Payment terms and bank details
  - Legal text (Portuguese tax compliance)
- [ ] GET `/api/invoices/:id/download` returns PDF
- [ ] GET `/api/invoices?clientId=X` lists client invoices
- [ ] POST `/api/invoices/generate` creates invoice for order/job
- [ ] Invoices automatically generated on order completion

### Email Notifications
- [ ] Email service configured (nodemailer + SMTP or SendGrid)
- [ ] Email templates for:
  - Order ready for pickup (laundry)
  - Job completed (cleaning)
  - Payment received
  - Invoice attached
  - Welcome email (new client)
- [ ] Automated triggers:
  - Laundry order status → `ready` sends "Ready for pickup" email
  - Cleaning job status → `completed` sends "Job completed" email
  - Payment recorded sends "Payment received" email with invoice
- [ ] Email logging in `job_notifications` table
- [ ] Client email preference settings (opt-in/opt-out)
- [ ] Admin manual send capability (resend notifications)

### General
- [ ] All responses use standardized envelope format
- [ ] RBAC enforced (Admin can view all, Client only own)
- [ ] E2E tests pass at ≥87.2% (no regressions)
- [ ] Documentation updated

---

## (iii) TERMINAL-FIRST PLAN

### Step 1: Database Schema (Invoices + Email Logging)

**File:** Create `migrations/20251108_invoices_notifications.sql`

```sql
-- ============================================
-- Migration: Invoice and Email Notification System
-- Date: 2025-11-08
-- Purpose: Invoice generation and automated email notifications
-- ============================================

BEGIN;

-- ===========================================
-- INVOICES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- INV-2025-11-0001
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,

    -- Reference to order/job (nullable - one of these must be set)
    cleaning_job_id INTEGER REFERENCES cleaning_jobs(id) ON DELETE CASCADE,
    laundry_order_id INTEGER REFERENCES laundry_orders_new(id) ON DELETE CASCADE,

    -- Client
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    client_name VARCHAR(200) NOT NULL,
    client_email VARCHAR(200),
    client_phone VARCHAR(20),
    client_address TEXT,
    client_nif VARCHAR(20),  -- Portuguese Tax ID

    -- Financial details (from VAT-enabled orders)
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    vat_rate NUMERIC(5,2) NOT NULL DEFAULT 23.00,
    vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, paid, cancelled
    payment_status VARCHAR(20),
    payment_date DATE,
    payment_method VARCHAR(50),

    -- PDF storage
    pdf_path TEXT,  -- Relative path to generated PDF
    pdf_generated_at TIMESTAMP,

    -- Metadata
    issued_by INTEGER REFERENCES users(id),  -- Admin/Master who issued
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (status IN ('pending', 'paid', 'cancelled')),
    CHECK (cleaning_job_id IS NOT NULL OR laundry_order_id IS NOT NULL),  -- At least one reference
    CHECK (total_amount >= 0)
);

-- Indexes
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_cleaning_job ON invoices(cleaning_job_id);
CREATE INDEX idx_invoices_laundry_order ON invoices(laundry_order_id);

COMMENT ON TABLE invoices IS 'Invoice records for both cleaning jobs and laundry orders';
COMMENT ON COLUMN invoices.invoice_number IS 'Unique sequential invoice number (INV-YYYY-MM-####)';
COMMENT ON COLUMN invoices.client_nif IS 'Portuguese NIF (Tax ID) for legal compliance';

-- ===========================================
-- INVOICE SEQUENCE GENERATOR FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_month TEXT;
    next_seq INTEGER;
    new_number TEXT;
BEGIN
    -- Format: INV-YYYY-MM-####
    year_month := TO_CHAR(NEW.invoice_date, 'YYYY-MM');

    -- Get next sequence for this month
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM '\\d{4}$') AS INTEGER)
    ), 0) + 1
    INTO next_seq
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_month || '-%';

    -- Generate invoice number
    new_number := 'INV-' || year_month || '-' || LPAD(next_seq::TEXT, 4, '0');

    NEW.invoice_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();

-- ===========================================
-- EMAIL NOTIFICATION PREFERENCES
-- ===========================================

-- Add email preference to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"order_ready": true, "job_completed": true, "payment_received": true, "invoice": true}'::jsonb;

COMMENT ON COLUMN clients.email_notifications_enabled IS 'Master toggle for all email notifications';
COMMENT ON COLUMN clients.notification_preferences IS 'Granular notification preferences (JSON)';

-- ===========================================
-- ENHANCE JOB_NOTIFICATIONS TABLE
-- ===========================================

-- Add columns if they don't exist (table already exists in schema)
ALTER TABLE job_notifications
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_error TEXT,
ADD COLUMN IF NOT EXISTS template_used VARCHAR(100);

COMMENT ON COLUMN job_notifications.notification_type IS 'Type: order_ready, job_completed, payment_received, invoice, etc.';
COMMENT ON COLUMN job_notifications.email_sent IS 'Whether email was successfully sent';
COMMENT ON COLUMN job_notifications.template_used IS 'Email template identifier';

-- Index for notification queries
CREATE INDEX IF NOT EXISTS idx_job_notifications_type ON job_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_job_notifications_sent ON job_notifications(email_sent, email_sent_at);

COMMIT;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Check invoices table
\d invoices;

-- Check clients notification columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'clients' AND column_name LIKE '%notification%';

-- Check job_notifications enhancements
\d job_notifications;
```

**Execution:**
```bash
# Apply migration
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_invoices_notifications.sql

# Verify tables
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d invoices"
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d+ job_notifications"
```

### Step 2: PDF Invoice Generation Service

**File:** Create `services/invoiceGenerator.js`

```javascript
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

/**
 * Invoice Generator Service
 * Generates professional PDF invoices for cleaning jobs and laundry orders
 */

class InvoiceGenerator {
    constructor() {
        this.invoicesDir = path.join(__dirname, '../invoices');
        this.logoPath = path.join(__dirname, '../assets/logo.png');

        // Ensure invoices directory exists
        if (!fs.existsSync(this.invoicesDir)) {
            fs.mkdirSync(this.invoicesDir, { recursive: true });
        }
    }

    /**
     * Generate invoice for a cleaning job or laundry order
     * @param {Object} options - { cleaningJobId OR laundryOrderId, issuedBy }
     * @returns {Object} - { invoiceId, invoiceNumber, pdfPath }
     */
    async generateInvoice(options) {
        const { cleaningJobId, laundryOrderId, issuedBy } = options;

        if (!cleaningJobId && !laundryOrderId) {
            throw new Error('Either cleaningJobId or laundryOrderId must be provided');
        }

        // Fetch order/job data with client and VAT details
        let orderData;
        if (cleaningJobId) {
            orderData = await this._fetchCleaningJobData(cleaningJobId);
        } else {
            orderData = await this._fetchLaundryOrderData(laundryOrderId);
        }

        // Create invoice record in database
        const invoiceRecord = await this._createInvoiceRecord({
            ...orderData,
            cleaningJobId,
            laundryOrderId,
            issuedBy
        });

        // Generate PDF
        const pdfPath = await this._generatePDF(invoiceRecord, orderData);

        // Update invoice record with PDF path
        await pool.query(
            'UPDATE invoices SET pdf_path = $1, pdf_generated_at = NOW() WHERE id = $2',
            [pdfPath, invoiceRecord.id]
        );

        return {
            invoiceId: invoiceRecord.id,
            invoiceNumber: invoiceRecord.invoice_number,
            pdfPath
        };
    }

    async _fetchCleaningJobData(jobId) {
        const result = await pool.query(`
            SELECT
                cj.id as job_id,
                cj.job_type,
                cj.property_name,
                cj.property_address,
                cj.scheduled_date,
                cj.completed_at,
                cj.subtotal_before_vat,
                cj.vat_rate,
                cj.vat_amount,
                cj.total_with_vat,
                c.full_name as client_name,
                c.email as client_email,
                c.phone_number as client_phone,
                c.address as client_address,
                c.nif as client_nif
            FROM cleaning_jobs cj
            JOIN clients c ON cj.client_id = c.id
            WHERE cj.id = $1
        `, [jobId]);

        if (result.rows.length === 0) {
            throw new Error(`Cleaning job ${jobId} not found`);
        }

        const job = result.rows[0];
        return {
            serviceType: 'Cleaning Service',
            serviceDescription: `${job.job_type === 'airbnb' ? 'Airbnb' : 'House'} Cleaning - ${job.property_name || job.property_address}`,
            serviceDate: job.scheduled_date,
            completedDate: job.completed_at,
            clientId: job.client_id,
            clientName: job.client_name,
            clientEmail: job.client_email,
            clientPhone: job.client_phone,
            clientAddress: job.client_address,
            clientNif: job.client_nif,
            subtotal: parseFloat(job.subtotal_before_vat || 0),
            vatRate: parseFloat(job.vat_rate || 23),
            vatAmount: parseFloat(job.vat_amount || 0),
            totalAmount: parseFloat(job.total_with_vat || 0)
        };
    }

    async _fetchLaundryOrderData(orderId) {
        const result = await pool.query(`
            SELECT
                lo.id as order_id,
                lo.order_number,
                lo.order_type,
                lo.total_weight_kg,
                lo.created_at,
                lo.collected_at,
                lo.subtotal_before_vat,
                lo.vat_rate,
                lo.vat_amount,
                lo.total_with_vat,
                c.id as client_id,
                c.full_name as client_name,
                c.email as client_email,
                c.phone_number as client_phone,
                c.address as client_address,
                c.nif as client_nif
            FROM laundry_orders_new lo
            JOIN clients c ON lo.client_id = c.id
            WHERE lo.id = $1
        `, [orderId]);

        if (result.rows.length === 0) {
            throw new Error(`Laundry order ${orderId} not found`);
        }

        const order = result.rows[0];
        return {
            serviceType: 'Laundry Service',
            serviceDescription: `${order.order_type === 'bulk_kg' ? 'Bulk Laundry' : order.order_type} - ${order.total_weight_kg || ''}kg`,
            orderNumber: order.order_number,
            serviceDate: order.created_at,
            completedDate: order.collected_at,
            clientId: order.client_id,
            clientName: order.client_name,
            clientEmail: order.client_email,
            clientPhone: order.client_phone,
            clientAddress: order.client_address,
            clientNif: order.client_nif,
            subtotal: parseFloat(order.subtotal_before_vat || 0),
            vatRate: parseFloat(order.vat_rate || 23),
            vatAmount: parseFloat(order.vat_amount || 0),
            totalAmount: parseFloat(order.total_with_vat || 0)
        };
    }

    async _createInvoiceRecord(data) {
        const result = await pool.query(`
            INSERT INTO invoices (
                cleaning_job_id, laundry_order_id, client_id,
                client_name, client_email, client_phone, client_address, client_nif,
                subtotal, vat_rate, vat_amount, total_amount,
                invoice_date, due_date, issued_by, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $13, 'pending'
            )
            RETURNING id, invoice_number, invoice_date, due_date
        `, [
            data.cleaningJobId || null,
            data.laundryOrderId || null,
            data.clientId,
            data.clientName,
            data.clientEmail,
            data.clientPhone,
            data.clientAddress,
            data.clientNif,
            data.subtotal,
            data.vatRate,
            data.vatAmount,
            data.totalAmount,
            data.issuedBy
        ]);

        return result.rows[0];
    }

    async _generatePDF(invoiceRecord, orderData) {
        const filename = `${invoiceRecord.invoice_number}.pdf`;
        const filepath = path.join(this.invoicesDir, filename);

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Header - Company Info
        doc.fontSize(20).text('LAVANDARIA', 50, 50);
        doc.fontSize(10)
            .text('Premium Cleaning Services', 50, 75)
            .text('NIF: PT123456789', 50, 90)  // Replace with actual company NIF
            .text('Rua Exemplo, 123, Lisboa', 50, 105)
            .text('Email: info@lavandaria.pt | Tel: +351 21 123 4567', 50, 120);

        // Invoice Title
        doc.fontSize(24).text('INVOICE', 400, 50);
        doc.fontSize(12)
            .text(`Invoice #: ${invoiceRecord.invoice_number}`, 400, 80)
            .text(`Date: ${invoiceRecord.invoice_date}`, 400, 95)
            .text(`Due Date: ${invoiceRecord.due_date}`, 400, 110);

        // Client Info
        doc.fontSize(12)
            .text('Bill To:', 50, 180)
            .fontSize(10)
            .text(orderData.clientName, 50, 200)
            .text(orderData.clientAddress || 'N/A', 50, 215)
            .text(`Email: ${orderData.clientEmail || 'N/A'}`, 50, 230)
            .text(`Phone: ${orderData.clientPhone || 'N/A'}`, 50, 245)
            .text(`NIF: ${orderData.clientNif || 'N/A'}`, 50, 260);

        // Service Details Table
        const tableTop = 320;
        doc.fontSize(12).text('Service Details', 50, tableTop - 20);

        // Table headers
        doc.fontSize(10)
            .text('Description', 50, tableTop, { width: 250 })
            .text('Amount', 350, tableTop, { width: 100, align: 'right' })
            .text('VAT', 450, tableTop, { width: 70, align: 'right' })
            .text('Total', 520, tableTop, { width: 70, align: 'right' });

        // Line under headers
        doc.moveTo(50, tableTop + 15).lineTo(590, tableTop + 15).stroke();

        // Service row
        const rowY = tableTop + 25;
        doc.fontSize(10)
            .text(orderData.serviceDescription, 50, rowY, { width: 250 })
            .text(`€${orderData.subtotal.toFixed(2)}`, 350, rowY, { width: 100, align: 'right' })
            .text(`€${orderData.vatAmount.toFixed(2)}`, 450, rowY, { width: 70, align: 'right' })
            .text(`€${orderData.totalAmount.toFixed(2)}`, 520, rowY, { width: 70, align: 'right' });

        // Totals section
        const totalsY = rowY + 60;
        doc.moveTo(350, totalsY - 10).lineTo(590, totalsY - 10).stroke();

        doc.fontSize(10)
            .text('Subtotal:', 350, totalsY)
            .text(`€${orderData.subtotal.toFixed(2)}`, 520, totalsY, { align: 'right' })
            .text(`VAT (${orderData.vatRate}%):`, 350, totalsY + 20)
            .text(`€${orderData.vatAmount.toFixed(2)}`, 520, totalsY + 20, { align: 'right' });

        doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Total Amount:', 350, totalsY + 45)
            .text(`€${orderData.totalAmount.toFixed(2)}`, 520, totalsY + 45, { align: 'right' });

        // Payment Terms
        doc.fontSize(10)
            .font('Helvetica')
            .text('Payment Terms:', 50, totalsY + 80)
            .text('Payment due within 30 days', 50, totalsY + 95)
            .text('Bank Transfer: IBAN PT50 0000 0000 0000 0000 0000 0', 50, totalsY + 110)
            .text('MBWay: +351 912 345 678', 50, totalsY + 125);

        // Legal Text (Portuguese Tax Compliance)
        doc.fontSize(8)
            .text('Este documento serve de fatura nos termos da legislação em vigor.', 50, totalsY + 160)
            .text('Processado por computador. Dispensa assinatura nos termos da alínea b) do nº1 do artigo 115 do CIVA.', 50, totalsY + 175);

        // Footer
        doc.fontSize(8)
            .text('Thank you for your business!', 50, 750, { align: 'center' });

        doc.end();

        // Wait for PDF to be written
        await new Promise((resolve, reject) => {
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        return `invoices/${filename}`;
    }
}

module.exports = new InvoiceGenerator();
```

**Install PDFKit:**
```bash
npm install pdfkit --save
```

### Step 3: Email Notification Service

**File:** Create `services/emailService.js`

```javascript
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');

/**
 * Email Notification Service
 * Sends automated emails for order status changes
 */

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        this.fromEmail = process.env.FROM_EMAIL || 'noreply@lavandaria.pt';
        this.fromName = process.env.FROM_NAME || 'Lavandaria';
    }

    /**
     * Send order ready notification (laundry)
     */
    async sendOrderReadyEmail(orderId, correlationId) {
        try {
            const order = await this._fetchOrderData(orderId);

            if (!order.client_email || !order.email_notifications_enabled) {
                console.log(`[${correlationId}] Email notifications disabled for client ${order.client_id}`);
                return { sent: false, reason: 'notifications_disabled' };
            }

            const subject = `🎉 Your Laundry is Ready! Order ${order.order_number}`;
            const html = this._renderOrderReadyTemplate(order);

            await this._sendEmail({
                to: order.client_email,
                subject,
                html,
                correlationId
            });

            await this._logNotification({
                type: 'order_ready',
                laundryOrderId: orderId,
                clientId: order.client_id,
                emailSent: true,
                template: 'order_ready'
            });

            return { sent: true };

        } catch (error) {
            console.error(`[${correlationId}] Error sending order ready email:`, error);

            await this._logNotification({
                type: 'order_ready',
                laundryOrderId: orderId,
                emailSent: false,
                emailError: error.message,
                template: 'order_ready'
            });

            throw error;
        }
    }

    /**
     * Send job completed notification (cleaning)
     */
    async sendJobCompletedEmail(jobId, correlationId) {
        try {
            const job = await this._fetchJobData(jobId);

            if (!job.client_email || !job.email_notifications_enabled) {
                return { sent: false, reason: 'notifications_disabled' };
            }

            const subject = `✅ Cleaning Job Completed - ${job.property_name}`;
            const html = this._renderJobCompletedTemplate(job);

            await this._sendEmail({
                to: job.client_email,
                subject,
                html,
                correlationId
            });

            await this._logNotification({
                type: 'job_completed',
                cleaningJobId: jobId,
                clientId: job.client_id,
                emailSent: true,
                template: 'job_completed'
            });

            return { sent: true };

        } catch (error) {
            console.error(`[${correlationId}] Error sending job completed email:`, error);

            await this._logNotification({
                type: 'job_completed',
                cleaningJobId: jobId,
                emailSent: false,
                emailError: error.message,
                template: 'job_completed'
            });

            throw error;
        }
    }

    /**
     * Send payment received notification with invoice
     */
    async sendPaymentReceivedEmail(invoiceId, correlationId) {
        try {
            const invoice = await this._fetchInvoiceData(invoiceId);

            if (!invoice.client_email) {
                return { sent: false, reason: 'no_email' };
            }

            const subject = `💰 Payment Received - Invoice ${invoice.invoice_number}`;
            const html = this._renderPaymentReceivedTemplate(invoice);

            const attachments = [];
            if (invoice.pdf_path) {
                const fs = require('fs');
                const path = require('path');
                const pdfFullPath = path.join(__dirname, '..', invoice.pdf_path);

                if (fs.existsSync(pdfFullPath)) {
                    attachments.push({
                        filename: `${invoice.invoice_number}.pdf`,
                        path: pdfFullPath
                    });
                }
            }

            await this._sendEmail({
                to: invoice.client_email,
                subject,
                html,
                attachments,
                correlationId
            });

            await this._logNotification({
                type: 'payment_received',
                cleaningJobId: invoice.cleaning_job_id,
                laundryOrderId: invoice.laundry_order_id,
                clientId: invoice.client_id,
                emailSent: true,
                template: 'payment_received'
            });

            return { sent: true };

        } catch (error) {
            console.error(`[${correlationId}] Error sending payment received email:`, error);
            throw error;
        }
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    async _sendEmail({ to, subject, html, attachments = [], correlationId }) {
        const mailOptions = {
            from: `"${this.fromName}" <${this.fromEmail}>`,
            to,
            subject,
            html,
            attachments
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[${correlationId}] Email sent to ${to}: ${info.messageId}`);

        return info;
    }

    async _fetchOrderData(orderId) {
        const result = await pool.query(`
            SELECT
                lo.id, lo.order_number, lo.status, lo.ready_at,
                c.id as client_id, c.full_name as client_name,
                c.email as client_email, c.phone_number as client_phone,
                c.email_notifications_enabled
            FROM laundry_orders_new lo
            JOIN clients c ON lo.client_id = c.id
            WHERE lo.id = $1
        `, [orderId]);

        return result.rows[0];
    }

    async _fetchJobData(jobId) {
        const result = await pool.query(`
            SELECT
                cj.id, cj.property_name, cj.status, cj.completed_at,
                c.id as client_id, c.full_name as client_name,
                c.email as client_email, c.phone_number as client_phone,
                c.email_notifications_enabled
            FROM cleaning_jobs cj
            JOIN clients c ON cj.client_id = c.id
            WHERE cj.id = $1
        `, [jobId]);

        return result.rows[0];
    }

    async _fetchInvoiceData(invoiceId) {
        const result = await pool.query(`
            SELECT
                id, invoice_number, total_amount, payment_date,
                client_id, client_name, client_email, pdf_path,
                cleaning_job_id, laundry_order_id
            FROM invoices
            WHERE id = $1
        `, [invoiceId]);

        return result.rows[0];
    }

    async _logNotification(data) {
        await pool.query(`
            INSERT INTO job_notifications (
                cleaning_job_id, laundry_order_id, client_id,
                notification_type, email_sent, email_sent_at, email_error, template_used
            ) VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN NOW() ELSE NULL END, $6, $7)
        `, [
            data.cleaningJobId || null,
            data.laundryOrderId || null,
            data.clientId,
            data.type,
            data.emailSent,
            data.emailError || null,
            data.template
        ]);
    }

    // ========================================
    // EMAIL TEMPLATES
    // ========================================

    _renderOrderReadyTemplate(order) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Your Laundry is Ready!</h1>
        </div>
        <div class="content">
            <p>Hello ${order.client_name},</p>
            <p>Great news! Your laundry order <strong>${order.order_number}</strong> is ready for pickup.</p>
            <p><strong>Pickup Details:</strong></p>
            <ul>
                <li>Order Number: ${order.order_number}</li>
                <li>Ready Since: ${new Date(order.ready_at).toLocaleString('pt-PT')}</li>
                <li>Location: Lavandaria, Rua Exemplo 123, Lisboa</li>
            </ul>
            <p>Please bring your order number when collecting your items.</p>
            <p>Thank you for choosing Lavandaria!</p>
        </div>
        <div class="footer">
            <p>Lavandaria - Premium Cleaning Services</p>
            <p>+351 21 123 4567 | info@lavandaria.pt</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    _renderJobCompletedTemplate(job) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Cleaning Job Completed</h1>
        </div>
        <div class="content">
            <p>Hello ${job.client_name},</p>
            <p>Your cleaning job for <strong>${job.property_name}</strong> has been completed!</p>
            <p><strong>Job Details:</strong></p>
            <ul>
                <li>Property: ${job.property_name}</li>
                <li>Completed: ${new Date(job.completed_at).toLocaleString('pt-PT')}</li>
            </ul>
            <p>You can now view before/after photos and provide feedback in your dashboard.</p>
            <p>Thank you for trusting Lavandaria with your cleaning needs!</p>
        </div>
        <div class="footer">
            <p>Lavandaria - Premium Cleaning Services</p>
            <p>+351 21 123 4567 | info@lavandaria.pt</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    _renderPaymentReceivedTemplate(invoice) {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💰 Payment Received</h1>
        </div>
        <div class="content">
            <p>Hello ${invoice.client_name},</p>
            <p>We have successfully received your payment!</p>
            <p><strong>Payment Details:</strong></p>
            <ul>
                <li>Invoice Number: ${invoice.invoice_number}</li>
                <li>Amount: €${invoice.total_amount.toFixed(2)}</li>
                <li>Payment Date: ${new Date(invoice.payment_date).toLocaleDateString('pt-PT')}</li>
            </ul>
            <p>Your invoice is attached to this email for your records.</p>
            <p>Thank you for your business!</p>
        </div>
        <div class="footer">
            <p>Lavandaria - Premium Cleaning Services</p>
            <p>+351 21 123 4567 | info@lavandaria.pt</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

module.exports = new EmailService();
```

**Install Nodemailer:**
```bash
npm install nodemailer --save
```

**Add to `.env`:**
```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@lavandaria.pt
FROM_NAME=Lavandaria
```

### Step 4: Invoice API Endpoints

**File:** Create `routes/invoices.js`

```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const { pool } = require('../config/database');
const { requireAuth, requireFinanceAccess } = require('../middleware/permissions');
const invoiceGenerator = require('../services/invoiceGenerator');
const emailService = require('../services/emailService');

// Generate invoice for cleaning job or laundry order
// POST /api/invoices/generate
router.post('/generate', requireFinanceAccess, async (req, res) => {
    try {
        const { cleaningJobId, laundryOrderId } = req.body;

        if (!cleaningJobId && !laundryOrderId) {
            return res.status(400).json({
                success: false,
                error: 'Either cleaningJobId or laundryOrderId required',
                code: 'INVALID_PARAMETERS',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const result = await invoiceGenerator.generateInvoice({
            cleaningJobId,
            laundryOrderId,
            issuedBy: req.session.userId
        });

        res.json({
            success: true,
            data: result,
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error generating invoice:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate invoice',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// List invoices (Admin sees all, Client sees own)
// GET /api/invoices?clientId=X&limit=20
router.get('/', requireAuth, async (req, res) => {
    try {
        const { clientId, limit = 50 } = req.query;

        // RBAC: Clients can only see their own invoices
        let finalClientId = clientId;
        if (req.session.userType === 'client') {
            // Get client record for logged-in user
            const clientResult = await pool.query(
                'SELECT id FROM clients WHERE user_id = $1',
                [req.session.userId]
            );
            if (clientResult.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'Client record not found',
                    code: 'FORBIDDEN',
                    _meta: {
                        correlationId: req.correlationId,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            finalClientId = clientResult.rows[0].id;
        }

        const query = finalClientId
            ? 'SELECT * FROM invoices WHERE client_id = $1 ORDER BY invoice_date DESC LIMIT $2'
            : 'SELECT * FROM invoices ORDER BY invoice_date DESC LIMIT $1';

        const params = finalClientId ? [finalClientId, limit] : [limit];
        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: {
                invoices: result.rows,
                count: result.rows.length
            },
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error(`[${req.correlationId}] Error fetching invoices:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch invoices',
            code: 'SERVER_ERROR',
            _meta: {
                correlationId: req.correlationId,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Download invoice PDF
// GET /api/invoices/:id/download
router.get('/:id/download', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT pdf_path, client_id FROM invoices WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found',
                code: 'NOT_FOUND',
                _meta: {
                    correlationId: req.correlationId,
                    timestamp: new Date().toISOString()
                }
            });
        }

        const invoice = result.rows[0];

        // RBAC: Clients can only download their own invoices
        if (req.session.userType === 'client') {
            const clientResult = await pool.query(
                'SELECT id FROM clients WHERE user_id = $1',
                [req.session.userId]
            );
            if (clientResult.rows.length === 0 || clientResult.rows[0].id !== invoice.client_id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    code: 'FORBIDDEN',
                    _meta: {
                        correlationId: req.correlationId,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }

        const pdfPath = path.join(__dirname, '..', invoice.pdf_path);
        res.download(pdfPath);

    } catch (error) {
        console.error(`[${req.correlationId}] Error downloading invoice:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to download invoice',
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

**Register in `server.js`:**
```javascript
const invoicesRoutes = require('./routes/invoices');
app.use('/api/invoices', invoicesRoutes);
```

### Step 5: Status Change Hooks (Automated Email Triggers)

**File:** Update `routes/laundry-orders.js` (Add trigger for "ready" status)

```javascript
// In the PATCH /api/laundry-orders/:id endpoint
// After updating status to "ready", trigger email notification

if (status === 'ready' && existingOrder.status !== 'ready') {
    // Trigger order ready email
    const emailService = require('../services/emailService');
    try {
        await emailService.sendOrderReadyEmail(orderId, req.correlationId);
    } catch (emailError) {
        console.error(`[${req.correlationId}] Failed to send ready email:`, emailError);
        // Don't fail the status update if email fails
    }
}
```

**File:** Update `routes/cleaning-jobs.js` (Add trigger for "completed" status)

```javascript
// In the PATCH /api/cleaning-jobs/:id endpoint
// After updating status to "completed", trigger email notification

if (status === 'completed' && existingJob.status !== 'completed') {
    // Trigger job completed email
    const emailService = require('../services/emailService');
    try {
        await emailService.sendJobCompletedEmail(jobId, req.correlationId);
    } catch (emailError) {
        console.error(`[${req.correlationId}] Failed to send completed email:`, emailError);
    }

    // Auto-generate invoice
    const invoiceGenerator = require('../services/invoiceGenerator');
    try {
        const invoice = await invoiceGenerator.generateInvoice({
            cleaningJobId: jobId,
            issuedBy: req.session.userId
        });
        console.log(`[${req.correlationId}] Auto-generated invoice: ${invoice.invoiceNumber}`);
    } catch (invoiceError) {
        console.error(`[${req.correlationId}] Failed to auto-generate invoice:`, invoiceError);
    }
}
```

### Step 6: Validation

```bash
# 1. Apply database migration
docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_invoices_notifications.sql

# 2. Install npm packages
npm install pdfkit nodemailer --save

# 3. Configure SMTP credentials in .env
nano .env
# Add: SMTP_HOST, SMTP_USER, SMTP_PASS, etc.

# 4. Test invoice generation manually
node -e "
const generator = require('./services/invoiceGenerator');
generator.generateInvoice({ cleaningJobId: 1, issuedBy: 1 })
    .then(result => console.log('Invoice generated:', result))
    .catch(err => console.error('Error:', err));
"

# 5. Test email sending manually
node -e "
const emailService = require('./services/emailService');
emailService.sendOrderReadyEmail(1, 'test-correlation-id')
    .then(result => console.log('Email sent:', result))
    .catch(err => console.error('Error:', err));
"

# 6. Run E2E tests
npm run test:e2e
# Expect: ≥87.2% pass rate (no regressions)

# 7. Manual UI testing
# - Mark laundry order as "ready" (should send email)
# - Mark cleaning job as "completed" (should send email + generate invoice)
# - Download invoice PDF from Admin dashboard
```

---

## (iv) ARTIFACTS

### Database Migration
- **File:** `migrations/20251108_invoices_notifications.sql`

### Backend Services
- **File:** `services/invoiceGenerator.js` - PDF generation
- **File:** `services/emailService.js` - Email notifications

### API Routes
- **File:** `routes/invoices.js` - Invoice CRUD endpoints

### Frontend Components (Future Enhancement)
- Invoice list view in Admin dashboard
- Invoice download button in Client dashboard

### Test Artifacts
- **File:** `test-results/invoices-notifications-validation.log`

---

## (v) DOCS AUTO-UPDATE SET

### docs/progress.md
```markdown
- ✅ **Invoice & Notification System** ([WO-20251108-invoices-notifications](../handoff/WO-20251108-invoices-notifications.md)):
  - PDF invoice generation with Portuguese tax compliance
  - Automated email notifications for order status changes
  - Invoice numbering system (INV-YYYY-MM-####)
  - Email templates: order ready, job completed, payment received
  - Status change hooks trigger automatic emails
  - RBAC: Admin sees all, Client sees own invoices
```

### docs/decisions.md
```markdown
## 2025-11-08T04:30:00Z - Invoice Generation & Email Notifications

### Context
Critical business operations missing:
- Customers need invoices for tax/expense purposes
- Manual notification process inefficient
- Portuguese tax compliance requires specific invoice format

### Options
1. **PDF generation + SMTP email** (pdfkit + nodemailer) ✅
2. **SaaS solution** (DocuSign, SendGrid templates)
3. **Manual invoice generation** (Excel templates)

### Decision
✅ **Option 1: Self-hosted PDF + Email**

Rationale:
- Full control over invoice format (Portuguese compliance)
- No per-invoice fees (SaaS expensive at scale)
- SMTP works with any email provider (Gmail, SendGrid, AWS SES)
- pdfkit flexible for customization

**Implementation:**
- pdfkit for PDF generation
- nodemailer for SMTP email
- Database triggers auto-generate invoices on completion
- Email templates in code (easy to modify)

### Consequences
**Positive:**
- Complete invoice customization
- Low operational cost
- Fast implementation

**Negative:**
- SMTP credentials needed (security risk if exposed)
- Email deliverability depends on SMTP provider
- PDF generation is synchronous (blocks request)

**Follow-up:**
- Move PDF generation to background queue (future)
- Consider transactional email service (SendGrid, Postmark)
- Add email bounce handling
```

### docs/architecture.md
```markdown
### Invoice System

**Database Schema:**
- `invoices` table with sequential numbering (INV-YYYY-MM-####)
- Foreign keys to both `cleaning_jobs` and `laundry_orders_new`
- Stores client snapshot (name, email, address, NIF) at time of invoice

**PDF Generation:**
- Service: `services/invoiceGenerator.js`
- Library: pdfkit
- Stored in: `invoices/` directory
- Includes: Company details, client info, itemized services, VAT breakdown, payment terms

**Email Notifications:**
- Service: `services/emailService.js`
- Library: nodemailer
- Triggers: Status changes (ready, completed, paid)
- Templates: HTML emails with company branding
- Logging: `job_notifications` table tracks all sent emails

**Automated Flows:**
1. Laundry order status → `ready`: Send "Order Ready" email
2. Cleaning job status → `completed`: Send "Job Completed" email + auto-generate invoice
3. Payment recorded: Send "Payment Received" email with invoice PDF attached
```

---

## (vi) PR PACKAGE

### Branch Name
```bash
git checkout -b feat/invoices-email-notifications
```

### Commit Messages

```bash
# Commit 1: Database migration
git add migrations/20251108_invoices_notifications.sql
git commit -m "feat(invoices): add invoices table and notification enhancements

- Create invoices table with sequential numbering (INV-YYYY-MM-####)
- Add email notification preferences to clients table
- Enhance job_notifications table with email tracking fields
- Database trigger for automatic invoice number generation

Refs: WO-20251108-invoices-notifications"

# Commit 2: Invoice generation service
git add services/invoiceGenerator.js package.json
git commit -m "feat(invoices): add PDF invoice generation service

- Implement InvoiceGenerator class with pdfkit
- Professional invoice template with Portuguese tax compliance
- Auto-calculate VAT breakdown from orders/jobs
- Store PDFs in invoices/ directory
- Support for both cleaning jobs and laundry orders

Refs: WO-20251108-invoices-notifications"

# Commit 3: Email service
git add services/emailService.js package.json .env.example
git commit -m "feat(notifications): add automated email notification service

- Implement EmailService with nodemailer
- Email templates: order ready, job completed, payment received
- HTML responsive templates with company branding
- Email logging in job_notifications table
- Support for PDF invoice attachments

Refs: WO-20251108-invoices-notifications"

# Commit 4: Invoice API
git add routes/invoices.js server.js
git commit -m "feat(invoices): add invoice CRUD API endpoints

- POST /api/invoices/generate - Create invoice (Admin/Master)
- GET /api/invoices - List invoices (RBAC: Admin all, Client own)
- GET /api/invoices/:id/download - Download PDF
- Finance access required for generation
- Client access restricted to own invoices

Refs: WO-20251108-invoices-notifications"

# Commit 5: Status change hooks
git add routes/laundry-orders.js routes/cleaning-jobs.js
git commit -m "feat(notifications): add automated email triggers on status changes

- Laundry order → ready: Send 'Order Ready' email
- Cleaning job → completed: Send 'Job Completed' email + auto-generate invoice
- Non-blocking email sending (errors logged but don't fail updates)

Refs: WO-20251108-invoices-notifications"

# Commit 6: Documentation
git add docs/progress.md docs/decisions.md docs/architecture.md
git commit -m "docs: record invoice and notification system implementation

- Added invoice generation decision to decisions.md
- Updated architecture.md with invoice/email flows
- Recorded implementation in progress.md

Refs: WO-20251108-invoices-notifications"
```

### PR Title & Description

```markdown
feat: invoice generation and automated email notifications

## Summary
Implements complete invoice generation system with PDF output and automated email notification service. Addresses critical business operations gap for Portuguese tax compliance and customer communication.

## Changes

### Database (Migration)
- ✅ `invoices` table with sequential numbering (INV-YYYY-MM-####)
- ✅ Invoice number auto-generation trigger
- ✅ Email notification preferences in `clients` table
- ✅ Enhanced `job_notifications` table for email tracking

### Backend Services
- ✅ `InvoiceGenerator` - PDF generation with pdfkit
- ✅ `EmailService` - SMTP email sending with nodemailer
- ✅ Invoice template: Portuguese tax compliance (NIF, VAT breakdown, legal text)
- ✅ Email templates: Order ready, Job completed, Payment received

### API Endpoints
- ✅ `POST /api/invoices/generate` - Create invoice (Admin/Master only)
- ✅ `GET /api/invoices` - List invoices (RBAC enforced)
- ✅ `GET /api/invoices/:id/download` - Download PDF

### Automated Triggers
- ✅ Laundry order status → `ready`: Send "Order Ready" email
- ✅ Cleaning job status → `completed`: Send email + auto-generate invoice
- ✅ Non-blocking email sending (errors logged, don't fail status updates)

## Business Value
- **Tax Compliance**: Professional invoices with Portuguese IVA requirements
- **Customer Experience**: Automated notifications reduce manual work
- **Operational Efficiency**: Auto-invoice generation on job completion
- **Audit Trail**: All emails logged in job_notifications table

## Testing
- [ ] Database migration applied successfully
- [ ] Invoice PDF generates correctly (cleaning + laundry)
- [ ] Invoice numbering sequential and unique
- [ ] Emails send on status changes (ready/completed)
- [ ] Invoice PDF attached to payment emails
- [ ] RBAC enforced (Client sees only own invoices)
- [ ] E2E tests pass at ≥87.2% (no regressions)

## Configuration Required
**Environment Variables (.env):**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@lavandaria.pt
FROM_NAME=Lavandaria
```

## Refs
- Work Order: [WO-20251108-invoices-notifications](../handoff/WO-20251108-invoices-notifications.md)
- Priority: P0 (Launch Blocker)
```

---

## (vii) IMPLEMENTER HANDOFF

### For Developer Agent

**Task:** Implement invoice generation and automated email notification system.

**Prerequisites:**
1. SMTP credentials (Gmail App Password or SendGrid API key)
2. Company logo PNG file (`assets/logo.png`)
3. Company NIF (Portuguese Tax ID) for invoices

**Execution Sequence:**

1. **Database Migration (10 min)**
   ```bash
   docker exec -i lavandaria-db psql -U lavandaria -d lavandaria < migrations/20251108_invoices_notifications.sql
   docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "\d invoices"
   ```

2. **Install Dependencies (5 min)**
   ```bash
   npm install pdfkit nodemailer --save
   ```

3. **Configure Environment (5 min)**
   ```bash
   nano .env
   # Add SMTP credentials (see section Step 3 above)
   ```

4. **Create Services (60 min)**
   ```bash
   nano services/invoiceGenerator.js  # Copy from Step 2
   nano services/emailService.js      # Copy from Step 3
   ```

5. **Create Invoice API (30 min)**
   ```bash
   nano routes/invoices.js            # Copy from Step 4

   # Register in server.js
   nano server.js
   # Add: const invoicesRoutes = require('./routes/invoices');
   #      app.use('/api/invoices', invoicesRoutes);
   ```

6. **Add Status Change Hooks (20 min)**
   ```bash
   nano routes/laundry-orders.js      # Add email trigger on "ready"
   nano routes/cleaning-jobs.js       # Add email trigger on "completed"
   # Copy code from Step 5
   ```

7. **Test Invoice Generation (10 min)**
   ```bash
   # Create test invoice via API (use Postman or curl)
   curl -X POST http://localhost:3000/api/invoices/generate \
     -H "Cookie: connect.sid=..." \
     -H "Content-Type: application/json" \
     -d '{"cleaningJobId": 1}'

   # Check invoices/ directory for PDF
   ls -la invoices/
   ```

8. **Test Email Sending (10 min)**
   ```bash
   # Update order status to trigger email
   # Or manually call email service:
   node -e "const e=require('./services/emailService'); e.sendOrderReadyEmail(1,'test').then(console.log)"
   ```

9. **Validation (15 min)**
   ```bash
   npm run test:e2e
   # Expect: ≥87.2% pass rate
   ```

10. **Documentation (10 min)**
    ```bash
    nano docs/progress.md docs/decisions.md docs/architecture.md
    git add -A
    git commit -m "feat: invoice generation and automated email notifications"
    ```

**Expected Outcome:**
- Invoices auto-generate on job completion
- PDFs downloadable via API
- Emails send automatically on status changes
- All emails logged in job_notifications table

### For Tester Agent

**Scenarios to Validate:**

1. **Invoice Generation (Cleaning Job)**
   - Create cleaning job (status: scheduled)
   - Update status to "completed"
   - Verify invoice auto-generated in database
   - Check PDF exists in `invoices/` directory
   - Verify invoice number format: INV-YYYY-MM-####

2. **Invoice Generation (Laundry Order)**
   - Create laundry order
   - Manually generate invoice via API
   - Verify PDF includes VAT breakdown
   - Check client details populated correctly

3. **Invoice Download (Admin)**
   - Login as admin
   - GET /api/invoices (should list all invoices)
   - GET /api/invoices/1/download (should return PDF)

4. **Invoice Download (Client RBAC)**
   - Login as client
   - GET /api/invoices (should only see own invoices)
   - Try to download another client's invoice (should get 403)

5. **Email: Order Ready Notification**
   - Create laundry order
   - Update status to "ready"
   - Check email sent to client
   - Verify email logged in job_notifications table

6. **Email: Job Completed Notification**
   - Create cleaning job
   - Update status to "completed"
   - Check email sent to client
   - Verify invoice attached (if generated)

7. **Email: Payment Received**
   - Record payment for invoice
   - Call sendPaymentReceivedEmail manually
   - Verify PDF attached to email

8. **Email Preferences (Opt-Out)**
   - Disable email_notifications_enabled for client
   - Update order status to "ready"
   - Verify email NOT sent

9. **Invoice Numbering Sequence**
   - Generate 3 invoices in same month
   - Verify sequential: INV-2025-11-0001, INV-2025-11-0002, INV-2025-11-0003

10. **E2E Regression**
    ```bash
    npm run test:e2e
    ```
    **Expected:** ≥41/47 passing (87.2%)

**Validation Checklist:**
- [ ] Invoices auto-generate on cleaning job completion
- [ ] Invoice PDFs include company details, VAT breakdown, legal text
- [ ] Invoice numbering sequential and unique per month
- [ ] Order ready email sends on laundry status → ready
- [ ] Job completed email sends on cleaning status → completed
- [ ] Payment received email includes invoice PDF
- [ ] Admin can download all invoices
- [ ] Client can only download own invoices (RBAC)
- [ ] Email preferences respected (opt-out works)
- [ ] All emails logged in job_notifications table
- [ ] E2E tests pass with no regressions

---

**End of Work Order**
