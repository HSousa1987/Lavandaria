# Jobs/Tasks System Design

## Overview

The Lavandaria system now supports two types of jobs:
1. **Cleaning Jobs** (Airbnb & Houses) - With time tracking, photo uploads, and client viewing
2. **Laundry Orders** (Bulk kg, Itemized, House Bundles) - With ready-to-collect notifications

Both systems are designed with **mobile app support** in mind (iOS/Android coming later).

---

## 🏠 CLEANING JOBS SYSTEM

### Database Tables

#### 1. `cleaning_jobs`
Main table for Airbnb and house cleaning jobs.

**Key Features:**
- Job types: `airbnb` or `house`
- Time tracking with start/end timestamps
- Auto-calculated billing (duration × hourly rate)
- Status workflow: `scheduled` → `in_progress` → `completed` → `cancelled`
- Payment tracking
- Client feedback and ratings

**Important Fields:**
```sql
- job_type: 'airbnb' or 'house'
- property_address: Full address details (split into line1, line2, city, postal_code)
- scheduled_date, scheduled_time: When cleaning should start
- actual_start_time, actual_end_time: When worker actually started/ended
- total_duration_minutes: AUTO-CALCULATED
- hourly_rate: Default 15.00 EUR
- total_cost: AUTO-CALCULATED (duration / 60 * hourly_rate)
- status: 'scheduled', 'in_progress', 'completed', 'cancelled'
- payment_status: 'pending', 'paid', 'partial'
```

**Workflow:**
1. Admin/Master creates job → `status = 'scheduled'`
2. Worker arrives, clicks "Start Job" → `status = 'in_progress'`, `actual_start_time = NOW()`
3. Worker uploads photos during/after cleaning
4. Worker clicks "End Job" → `status = 'completed'`, `actual_end_time = NOW()`, cost auto-calculated
5. Client can view photos
6. Payment processed

#### 2. `cleaning_time_logs`
Tracks worker time with precision (supports multiple workers per job).

**Purpose:**
- Accurate billing
- Multiple workers can log time on same job
- GPS coordinates for mobile app (future)

**Fields:**
```sql
- start_time, end_time: Timestamp when worker started/stopped
- duration_minutes: AUTO-CALCULATED
- start_latitude, start_longitude: GPS location (mobile app)
- end_latitude, end_longitude: GPS location (mobile app)
```

#### 3. `cleaning_job_photos`
Before/after/detail photos for client viewing.

**Photo Types:**
- `before`: Pre-cleaning photos
- `after`: Post-cleaning photos
- `detail`: Close-up details

**Features:**
- Organized by room/area (Kitchen, Bathroom, Living Room, etc.)
- Thumbnail support for mobile app
- Track if client viewed photos
- Worker attribution (who uploaded)

**Fields:**
```sql
- photo_url: Full-size photo path
- thumbnail_url: Smaller version for mobile
- photo_type: 'before', 'after', 'detail'
- room_area: 'Kitchen', 'Bathroom', etc.
- viewed_by_client: Boolean flag
- viewed_at: Timestamp when client viewed
```

---

## 👕 LAUNDRY ORDERS SYSTEM

### Database Tables

#### 1. `laundry_orders_new`
Main laundry orders table supporting 3 order types.

**Order Types:**

**A. Bulk by Kilograms (`bulk_kg`)**
- Simple weight-based pricing
- Client brings clothes, you weigh them
- Price calculated: `weight_kg × price_per_kg`
- Example: 5.5 kg × 3.50 EUR/kg = 19.25 EUR

**B. Itemized (`itemized`)**
- Individual item pricing
- Each item tracked separately
- Total = sum of all items
- Example:
  - 3 shirts @ 2.50 EUR = 7.50 EUR
  - 2 pants @ 3.00 EUR = 6.00 EUR
  - 5 towels @ 1.50 EUR = 7.50 EUR
  - **Total: 21.00 EUR**

**C. House Bundle (`house_bundle`)**
- For large orders (sheets, blankets, towels, curtains)
- Mix of bulk + itemized
- Special pricing for bulk home items

**Status Workflow:**
```
received → in_progress → ready → collected
```

**Key Fields:**
```sql
- order_number: Unique tracking number (e.g., 'LDR-20251002-001')
- order_type: 'bulk_kg', 'itemized', or 'house_bundle'
- total_weight_kg: For bulk orders
- price_per_kg: Default 3.50 EUR
- base_price: Before extras
- additional_charges: Express service, special treatment, etc.
- discount: Loyalty discount, promo codes
- total_price: AUTO-CALCULATED
- status: 'received', 'in_progress', 'ready', 'collected'
- expected_ready_date: When it will be ready
- ready_notification_sent: Boolean flag for SMS/push notification
- ready_notification_sent_at: When notification was sent
- client_notified_via: 'sms', 'email', 'push', 'whatsapp'
```

#### 2. `laundry_order_items`
Individual items in itemized/house_bundle orders.

**Purpose:**
- Track each piece of clothing
- Different pricing per item type
- Note special conditions or damage
- Track status per item

**Item Types:**
- Clothing: shirt, pants, dress, suit, coat, etc.
- Bedding: sheets, blanket, duvet, pillowcase, etc.
- Home: towel, curtain, tablecloth, etc.

**Fields:**
```sql
- item_type: 'shirt', 'pants', 'blanket', etc.
- item_category: 'clothing', 'bedding', 'curtains'
- quantity: How many of this item
- unit_price: Price per item
- total_price: quantity × unit_price
- condition_notes: 'stain on collar', 'missing button'
- special_treatment: 'delicate', 'dry-clean', 'iron-only'
- status: 'pending', 'washing', 'drying', 'ironing', 'ready'
```

---

## 🔔 NOTIFICATION SYSTEM

### `job_notifications` Table
Unified notification system for all alerts.

**Notification Types:**
- `job_assigned`: Worker assigned to cleaning job
- `job_started`: Worker started job
- `job_completed`: Job finished, photos available
- `laundry_ready`: **Client's laundry is ready to collect!** ⭐
- `laundry_collected`: Laundry collected
- `payment_received`: Payment confirmed
- `photo_uploaded`: New photos available for viewing
- `feedback_requested`: Please rate our service

**Delivery Methods:**
- `push`: Mobile app push notification (iOS/Android)
- `sms`: SMS text message
- `email`: Email notification
- `in_app`: In-app notification badge

**Fields:**
```sql
- notification_type: Type of notification
- user_id: For staff notifications
- client_id: For client notifications
- title: Notification title
- message: Full message text
- delivery_method: 'push', 'sms', 'email', 'in_app'
- status: 'pending', 'sent', 'delivered', 'read', 'failed'
- push_token: FCM (Android) / APNs (iOS) device token
- deep_link: App URL for navigation (e.g., 'app://jobs/123')
```

---

## 🔄 USER WORKFLOWS

### Admin/Master Workflow

#### Creating Cleaning Job:
1. Click "Jobs" → "New Cleaning Job"
2. Fill form:
   - **Job Type**: Airbnb or House
   - **Client**: Select from dropdown (or create new)
   - **Property Address**: Full address with city, postal code
   - **Property Name**: e.g., "Apartment 12B" (optional for houses)
   - **Scheduled Date & Time**: When cleaning should happen
   - **Assign Worker**: Select worker (or leave unassigned)
   - **Special Instructions**: Key location, pet info, etc.
3. Click "Create Job"
4. System status: `scheduled`

#### Creating Laundry Order:
1. Click "Laundry" → "New Order"
2. **Select Order Type:**

   **Option A - Bulk by Weight:**
   - Select "Bulk by Kilograms"
   - Client: Select client
   - Weight: Enter kg (e.g., 5.5)
   - Price per kg: Default 3.50 EUR (editable)
   - Total: Auto-calculated
   - Expected ready date: Select date

   **Option B - Itemized:**
   - Select "Itemized"
   - Client: Select client
   - Add items:
     - Item type: Dropdown (Shirt, Pants, Dress, etc.)
     - Quantity: Number
     - Unit price: Auto-filled, editable
     - Condition notes: Optional
     - Special treatment: Optional
   - Click "Add Another Item" to add more
   - Total: Auto-calculated from all items

   **Option C - House Bundle:**
   - Select "House Bundle"
   - Client: Select client
   - Mix of items and bulk weight
   - Special pricing applied

3. Click "Create Order"
4. System generates order number: `LDR-20251002-001`
5. Status: `received`

---

### Worker Workflow

#### For Cleaning Jobs:
1. **View Assigned Jobs:**
   - Dashboard shows "My Jobs" list
   - Filter: Scheduled, In Progress, Completed
   - See: Address, Client name, Scheduled time

2. **Start Job:**
   - Arrive at property
   - Click "Start Job" button
   - System records `actual_start_time`
   - Status changes to `in_progress`
   - Timer starts (for billing)

3. **Upload Photos:**
   - During or after cleaning
   - Click "Add Photo"
   - Select photo type: Before/After/Detail
   - Select room/area: Kitchen, Bathroom, etc.
   - Add caption (optional)
   - Upload
   - Photos immediately available to client

4. **End Job:**
   - Cleaning complete
   - Click "End Job" button
   - System records `actual_end_time`
   - Duration auto-calculated
   - Total cost auto-calculated
   - Status changes to `completed`

#### For Laundry Orders:
1. **View Orders:**
   - Dashboard shows orders by status
   - `received`, `in_progress`, `ready`

2. **Process Order:**
   - Mark items as done individually (if itemized)
   - Move status: `received` → `in_progress` → `ready`

3. **Mark Ready to Collect:**
   - When laundry is complete
   - Click "Mark Ready" button
   - System:
     - Sets `status = 'ready'`
     - Sets `ready_at = NOW()`
     - Creates notification
     - Sends SMS/Push to client: "Your laundry is ready!"
     - Sets `ready_notification_sent = TRUE`

4. **Mark Collected:**
   - When client collects
   - Click "Mark Collected"
   - Status: `collected`
   - Record payment if needed

---

### Client Workflow

#### Viewing Cleaning Jobs:
1. Login to client portal
2. View "My Cleaning Jobs"
3. See list of scheduled, in-progress, completed jobs
4. **View Photos:**
   - Click on completed job
   - See before/after photos organized by room
   - Photos marked as "viewed"
   - Can download photos

#### Viewing Laundry Orders:
1. View "My Laundry Orders"
2. See order status in real-time
3. **Get Notifications:**
   - SMS: "Your laundry order LDR-20251002-001 is ready to collect!"
   - Push notification (mobile app)
   - Email notification
4. See order details:
   - Items list (if itemized)
   - Weight (if bulk)
   - Total price
   - Ready date
5. Mark as collected when picked up

---

## 💰 PRICING & BILLING

### Cleaning Jobs:
```javascript
// Auto-calculated by database trigger
total_duration_minutes = (end_time - start_time) / 60
total_cost = (total_duration_minutes / 60) * hourly_rate

Example:
Start: 10:00 AM
End: 12:30 PM
Duration: 150 minutes (2.5 hours)
Rate: 15.00 EUR/hour
Cost: 2.5 × 15.00 = 37.50 EUR
```

### Laundry Orders:

**Bulk:**
```javascript
total_price = total_weight_kg * price_per_kg

Example:
Weight: 5.5 kg
Price: 3.50 EUR/kg
Total: 19.25 EUR
```

**Itemized:**
```javascript
total_price = sum(item_quantity × item_unit_price for all items)

Example:
3 shirts @ 2.50 = 7.50
2 pants @ 3.00 = 6.00
5 towels @ 1.50 = 7.50
Total: 21.00 EUR
```

**With Extras:**
```javascript
final_price = base_price + additional_charges - discount

Example:
Base: 21.00 EUR
Express service: +10.00 EUR
Discount (loyalty): -3.00 EUR
Final: 28.00 EUR
```

---

## 📱 MOBILE APP PREPARATION

The database is ready for iOS/Android apps:

### Supported Features:
- ✅ GPS location tracking (lat/long fields)
- ✅ Push notification tokens (FCM/APNs)
- ✅ Photo thumbnails for faster loading
- ✅ Deep linking (`app://jobs/123`)
- ✅ Offline sync timestamps (`last_synced_at`)
- ✅ Read/delivered tracking
- ✅ Multiple notification methods

### API Endpoints Needed (Future):
```
POST /api/mobile/time/start     - Start time tracking with GPS
POST /api/mobile/time/end       - End time tracking with GPS
POST /api/mobile/photos/upload  - Upload photo from phone
GET  /api/mobile/jobs/assigned  - Get worker's assigned jobs
GET  /api/mobile/notifications  - Get unread notifications
POST /api/mobile/register       - Register device push token
```

---

## 🎯 KEY FEATURES IMPLEMENTED

### ✅ For Cleaning Jobs:
1. Separate forms for Airbnb vs House cleaning
2. Time tracking with start/stop buttons
3. Auto-calculated billing
4. Photo uploads (before/after/detail)
5. Photo organization by room/area
6. Client can view photos
7. Worker assignment
8. Status workflow
9. GPS ready for mobile app

### ✅ For Laundry:
1. Three order types: bulk kg, itemized, house bundle
2. Individual item tracking with descriptions
3. "Ready to collect" notification system
4. SMS/Email/Push notification support
5. Order number generation
6. Status workflow
7. Special treatment tracking
8. Condition notes for damaged items

---

## 🚀 NEXT STEPS

### Backend Routes (To Be Created):
1. `/api/cleaning-jobs` - CRUD for cleaning jobs
2. `/api/cleaning-jobs/:id/start` - Start job (worker)
3. `/api/cleaning-jobs/:id/end` - End job (worker)
4. `/api/cleaning-jobs/:id/photos` - Upload photos
5. `/api/cleaning-jobs/:id/photos` - Get photos (client)
6. `/api/laundry-orders` - CRUD for laundry
7. `/api/laundry-orders/:id/items` - Manage items
8. `/api/laundry-orders/:id/ready` - Mark ready + notify
9. `/api/notifications` - Get user notifications
10. `/api/notifications/:id/read` - Mark as read

### Frontend Forms (To Be Created):
1. Cleaning job creation form (Airbnb/House selection)
2. Laundry order form with type selector
3. Worker time tracking interface
4. Photo upload interface
5. Client photo gallery view
6. Notification center
7. "Mark Ready" button with notification preview

---

## 📊 SAMPLE DATA INCLUDED

After running migrations, you'll have:
- 1 sample cleaning job (Airbnb in Lisboa)
- 2 sample laundry orders (1 bulk, 1 itemized with 3 items)

Check with:
```bash
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM cleaning_jobs;"
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM laundry_orders_new;"
docker exec lavandaria-db psql -U lavandaria -d lavandaria -c "SELECT * FROM laundry_order_items;"
```

---

## 🎉 READY FOR DEVELOPMENT

The database schema is complete and tested. The system is ready for:
1. Backend route implementation
2. Frontend form development
3. Worker interface creation
4. Client portal updates
5. Notification system integration
6. Future mobile app development

**Deploy with:** `./deploy.sh` - All migrations run automatically! ✅
