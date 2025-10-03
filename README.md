# 🧺 Lavandaria - Laundry & Airbnb Cleaning Management System

A complete business management system for laundry services and Airbnb property cleaning with photo verification, time tracking, and financial management.

## 🚀 Quick Start

**One-command deployment:**

```bash
./deploy.sh
```

Access the application at: **http://localhost:3000**

## 📋 What's Included

### ✅ Complete Features:
- **Multi-role user system** (Master, Admin, Worker, Client)
- **Client CRM** with full CRUD operations
- **Laundry order management** with service catalog
- **Airbnb cleaning orders** with photo verification
- **Time tracking** for workers
- **Payment & finance tracking** (hidden from workers)
- **Ticket system** for workers to report issues
- **Service catalog** with 12 pre-configured services
- **Order items breakdown** for detailed invoicing
- **Status history tracking** for all orders

### 🔐 Default Login Credentials:

**Master (Full Access):**
- Username: `master`
- Password: `master123`

**Admin (Finance + Management):**
- Username: `admin`
- Password: `admin123`

**Worker (Operations Only):**
- Username: `worker1`
- Password: `worker123`

**Sample Client:**
- Phone: `911111111`
- Password: `lavandaria2025`

⚠️ **IMPORTANT:** Change all passwords after first login!

## 🏗️ System Architecture

### Tech Stack:
- **Frontend:** React 19 + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL 16
- **Deployment:** Docker + Docker Compose
- **Platform:** Ubuntu (containerized)

### Database Tables (19 total):
1. `users` - Staff accounts (master/admin/worker)
2. `clients` - Customer accounts
3. `laundry_orders` - Clothing cleaning orders
4. `airbnb_orders` - Property cleaning orders
5. `services` - Service catalog with pricing
6. `order_items` - Line items for orders
7. `order_status_history` - Track all status changes
8. `cleaning_photos` - Photo verification
9. `time_logs` - Worker time tracking
10. `payments` - Financial transactions
11. `tickets` - Issue reporting
12. `session` - User sessions

## 👥 User Roles & Permissions

### 🔑 Master (Business Owner)
- Full system access
- Create/manage admins and workers
- Full finance access
- All client and order management

### 👔 Admin (Manager)
- Create/manage workers (NOT other admins)
- Full client management
- Full order management
- Full finance access
- Ticket management

### 👷 Worker (Cleaner)
- View assigned orders only
- Upload cleaning photos
- Track time worked
- Create tickets for issues
- **NO finance access**
- **NO user/client management**

### 👤 Client (Customer)
- View own orders only
- Change password
- Read-only access

## 💰 Service Catalog

### Laundry Services:
1. **Wash & Fold** - €8/kg (24h)
2. **Dry Cleaning** - €12/item (48h)
3. **Iron Only** - €3/item (12h)
4. **Express Wash** - €15/kg (3h)
5. **Delicate Care** - €10/kg (24h)

### Airbnb Cleaning:
1. **Studio Cleaning** - €45 (90min)
2. **1-Bedroom Cleaning** - €65 (120min)
3. **2-Bedroom Cleaning** - €85 (150min)
4. **Deep Clean** - €120 (240min)
5. **Check-Out Clean** - €75 (120min)
6. **Linen Change** - €20 (30min)
7. **Restocking** - €15 (20min)

*All services can be customized via Admin panel*

## 📱 Key Features

### For Master/Admin:
- Dashboard with revenue statistics
- Client CRM (create, edit, delete)
- Create orders with multiple services
- Payment tracking
- Worker performance monitoring
- Ticket management

### For Workers:
- View assigned cleaning jobs
- Upload before/after photos
- Track work hours (start/stop timer)
- Report issues via tickets
- Update job status

### For Clients:
- View current orders
- See order history
- Track order status
- View cleaning photos (for Airbnb)

## 🛠️ Development

### Run without Docker:

**Backend:**
```bash
npm install
npm run server
```

**Frontend:**
```bash
cd client
npm install
npm start
```

### Docker Commands:
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Rebuild
docker-compose build --no-cache && docker-compose up -d
```

### Database Access:
```bash
# Connect to PostgreSQL
docker exec -it lavandaria-db psql -U lavandaria -d lavandaria

# Backup
docker exec lavandaria-db pg_dump -U lavandaria lavandaria > backup.sql
```

## 📊 Business Processes

### Laundry Order Flow:
```
Create Order → Receive Items → Process → Ready → Deliver → Complete
```

### Airbnb Cleaning Flow:
```
Schedule → Assign Worker → Worker Arrives → Clean → Upload Photos → Complete
```

### Payment Flow:
```
Service Completed → Invoice Generated → Payment Received → Mark as Paid
```

## 🎫 Ticket System

Workers can create tickets when they encounter problems:

**Example Tickets:**
- "Missing cleaning supplies at property"
- "Client not available for key pickup"
- "Stain couldn't be removed"
- "Property access code not working"

**Ticket Priority Levels:**
- Low, Medium, High, Urgent

**Ticket Workflow:**
- Worker creates ticket
- Admin/Master reviews
- Admin assigns to responsible person
- Issue gets resolved
- Ticket closed

## 📈 Reports & Analytics

### Dashboard Statistics:
- Total clients
- Total orders (laundry + Airbnb)
- Total revenue
- Pending payments
- Recent orders

### Future Enhancements:
- Revenue by period
- Worker performance metrics
- Service popularity analysis
- Client retention stats

## 🔒 Security Features

- Bcrypt password hashing
- Session-based authentication
- HTTP-only cookies
- CORS protection
- Helmet.js security headers
- SQL injection prevention (parameterized queries)
- Role-based access control

## 📁 Project Structure

```
Lavandaria/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   └── context/       # Auth context
│   └── public/
├── routes/                # Express API routes
│   ├── auth.js
│   ├── users.js
│   ├── clients.js
│   ├── laundry.js
│   ├── airbnb.js
│   ├── payments.js
│   ├── tickets.js
│   └── dashboard.js
├── middleware/            # Permission middleware
├── database/              # PostgreSQL schema
├── uploads/               # Photo storage
├── server.js              # Express server
├── deploy.sh              # Deployment script
└── docker-compose.yml     # Docker configuration
```

## 📝 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete technical documentation
- **[ROLE_HIERARCHY_SUMMARY.md](ROLE_HIERARCHY_SUMMARY.md)** - User roles explained
- **[BUSINESS_ANALYSIS.md](BUSINESS_ANALYSIS.md)** - Business features and roadmap

## 🐛 Troubleshooting

**Database won't start:**
```bash
docker-compose down -v
./deploy.sh
```

**Port conflicts:**
Edit `docker-compose.yml` ports section

**Permission errors:**
```bash
chmod -R 755 uploads/
```

**React build issues:**
```bash
cd client
rm -rf node_modules
npm install
```

## 🎯 Next Steps After Deployment

1. ✅ Deploy: Run `./deploy.sh`
2. ✅ Login as master
3. ✅ Change master password
4. ✅ Create real admin users
5. ✅ Create worker accounts for cleaners
6. ✅ Add your clients
7. ✅ Customize service prices
8. ✅ Create your first order!

## 🤝 Support

For technical documentation, see [CLAUDE.md](CLAUDE.md)

For business features, see [BUSINESS_ANALYSIS.md](BUSINESS_ANALYSIS.md)

---

**Built with ❤️ for efficient laundry and cleaning business management**

Generated with Claude Code
