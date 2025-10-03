# 🧪 Browser Testing Guide - Lavandaria

**Last Updated:** 2025-10-01 22:50:00
**Application URL:** http://localhost:3000

---

## ✅ All Issues Fixed

### **Fixed in Latest Deployment:**
1. ✅ CORS configuration updated to allow same-origin requests
2. ✅ Cookie settings fixed (secure: false, sameSite: 'lax')
3. ✅ Password change endpoint now works for ALL user types (not just clients)
4. ✅ Authentication check working correctly

---

## 🧪 Step-by-Step Testing Instructions

### **Test 1: Master Login & Dashboard**

1. Open browser: http://localhost:3000
2. Click "Staff Login" tab
3. Enter credentials:
   ```
   Username: master
   Password: master123
   ```
4. Click "Login"

**Expected Result:**
- ✅ Redirects to `/dashboard`
- ✅ Header shows "Welcome, Master Admin (master)"
- ✅ See 4 tabs: Overview, All Users, Clients, All Jobs
- ✅ Overview shows statistics (clients, orders, revenue)

**Test Master Privileges:**
- Click "All Users" tab
- Click "Add User" button
- Try to create admin user - Role dropdown should show "Admin" option
- Master can see and manage ALL users

---

### **Test 2: Admin Login & Dashboard**

1. Logout (click logout button)
2. Login with admin credentials:
   ```
   Username: admin
   Password: admin123
   ```

**Expected Result:**
- ✅ Redirects to `/dashboard`
- ✅ Header shows "Welcome, Administrator (admin)"
- ✅ See 4 tabs: Overview, Workers, Clients, All Jobs
- ✅ Overview shows statistics with billing info

**Test Admin Privileges:**
- Click "Workers" tab (NOT "All Users" - admin can only manage workers)
- Click "Add User" button
- Role dropdown should ONLY show "Worker" (no Admin option)
- Admin CANNOT create other admins

---

### **Test 3: Worker Login & Dashboard**

1. Logout
2. Login with worker credentials:
   ```
   Username: worker1
   Password: worker123
   ```

**Expected Result:**
- ✅ Redirects to `/dashboard`
- ✅ Header shows "Welcome, Maria Silva (worker)"
- ✅ See 3 tabs: Overview, My Jobs, Client Contacts
- ✅ Overview shows job counts (NO pricing/billing)

**Test Worker Privileges:**
- Click "My Jobs" tab - should see assigned Airbnb orders
- **Pricing should NOT be visible** (workers don't see financial info)
- Click "Client Contacts" tab - should see phone numbers and emails
- Worker has NO "Users" or "Clients" management tabs

---

### **Test 4: Client Login & Password Change**

1. Logout
2. Login with client credentials:
   ```
   Phone: 911111111
   Password: lavandaria2025
   ```

**Expected Result:**
- ✅ Redirects to `/change-password` (first login)
- ✅ Shows password change form

**Test Password Change:**
- Current Password: `lavandaria2025`
- New Password: `NewPass123!`
- Confirm Password: `NewPass123!`
- Click "Change Password"

**Expected Result:**
- ✅ Success message: "Password changed successfully!"
- ✅ Redirects to `/dashboard` after 2 seconds
- ✅ Dashboard shows client's orders

**Test Login with New Password:**
- Logout
- Login again with:
  ```
  Phone: 911111111
  Password: NewPass123!
  ```
- ✅ Should login directly to dashboard (no password change required)

---

### **Test 5: Password Change for Staff**

1. Login as admin or master
2. Navigate to `/change-password` manually: http://localhost:3000/change-password

**Expected Result:**
- ✅ Password change form works for admin/master too
- ✅ No 403 error
- ✅ Can change password successfully

---

### **Test 6: Navigation & Session Persistence**

**Test Redirects:**
1. When logged in, try accessing `/` - should redirect to `/dashboard`
2. When logged out, try accessing `/dashboard` - should redirect to `/`

**Test Session:**
1. Login as any user
2. Refresh the page
3. ✅ Should stay logged in (session persists)
4. Close and reopen browser
5. Go to http://localhost:3000/dashboard
6. ✅ Should still be logged in (session cookie saved)

---

### **Test 7: Role-Based Content Filtering**

**Login as each role and verify tabs:**

| Role | Tabs Visible | Can Create Users | Can See Billing |
|------|-------------|------------------|-----------------|
| **Master** | Overview, All Users, Clients, All Jobs | ✅ Admin + Workers | ✅ Yes |
| **Admin** | Overview, Workers, Clients, All Jobs | ✅ Workers only | ✅ Yes |
| **Worker** | Overview, My Jobs, Client Contacts | ❌ No | ❌ No |
| **Client** | Overview, Jobs | ❌ No | ❌ No |

---

### **Test 8: User Creation Permissions**

**As Master:**
1. Go to "All Users" tab
2. Click "Add User"
3. Role dropdown should show:
   - Admin
   - Worker
4. Create a test worker

**As Admin:**
1. Go to "Workers" tab
2. Click "Add Worker"
3. Role dropdown should ONLY show:
   - Worker (no Admin option)

**As Worker/Client:**
- Should not see any user creation buttons

---

### **Test 9: Client Creation (Master/Admin)**

1. Login as Master or Admin
2. Go to "Clients" tab
3. Click "Add Client"
4. Fill in:
   ```
   Phone: 912345678
   Full Name: Test Client
   Email: test@example.com
   ```
5. Click "Create"
6. ✅ New client should appear in table
7. ✅ Default password is `lavandaria2025`

**Test New Client Login:**
1. Logout
2. Login with:
   ```
   Phone: 912345678
   Password: lavandaria2025
   ```
3. ✅ Should be forced to change password
4. ✅ After password change, redirects to dashboard

---

### **Test 10: Logout Functionality**

1. Login as any user
2. Click "Logout" button in header
3. ✅ Should redirect to `/` (landing page)
4. ✅ Try accessing `/dashboard` - should redirect to `/`
5. ✅ Session cleared

---

## 🐛 Common Issues & Solutions

### **Issue: "authenticated: false" even after login**
**Solution:** ✅ FIXED - Updated CORS and cookie settings

### **Issue: Password change returns 403**
**Solution:** ✅ FIXED - Updated endpoint to support all user types

### **Issue: Not redirecting to dashboard**
**Solution:** ✅ FIXED - All users now redirect to `/dashboard`

### **Issue: Can't see proper content in dashboard**
**Solution:** ✅ FIXED - Role-based content filtering implemented

---

## 📋 Testing Checklist

Use this checklist when testing:

### Authentication
- [ ] Master login works
- [ ] Admin login works
- [ ] Worker login works
- [ ] Client login works
- [ ] Invalid credentials show error
- [ ] Session persists after refresh
- [ ] Logout works

### Dashboard Access
- [ ] Master sees all tabs
- [ ] Admin sees correct tabs (no "All Users")
- [ ] Worker sees limited tabs (no billing)
- [ ] Client sees minimal tabs

### Permissions
- [ ] Master can create admins
- [ ] Admin CANNOT create admins
- [ ] Admin can create workers
- [ ] Worker cannot create users
- [ ] Master/Admin can create clients

### Password Change
- [ ] Client forced to change password on first login
- [ ] Password change works for clients
- [ ] Password change works for staff (admin/master)
- [ ] Can login with new password
- [ ] Old password no longer works

### Content Filtering
- [ ] Master sees billing/revenue
- [ ] Admin sees billing/revenue
- [ ] Worker does NOT see pricing
- [ ] Client sees only own data

### Navigation
- [ ] All redirects work correctly
- [ ] Protected routes require login
- [ ] Role-based content shows/hides properly

---

## ✅ Expected Behavior Summary

### **After Login:**
- All users → `/dashboard`
- Clients (first login) → `/change-password` → `/dashboard`

### **Dashboard Content:**
```
Master:   [Overview] [All Users] [Clients] [All Jobs]
Admin:    [Overview] [Workers]   [Clients] [All Jobs]
Worker:   [Overview] [My Jobs]   [Client Contacts]
Client:   [Overview] [Jobs]
```

### **Pricing Visibility:**
- Master: ✅ Sees all prices
- Admin: ✅ Sees all prices
- Worker: ❌ NO pricing shown
- Client: Sees own order prices

---

## 🔧 Browser DevTools Check

### **Check Cookies:**
1. Open DevTools (F12)
2. Go to Application → Cookies → http://localhost:3000
3. Should see `connect.sid` cookie
4. Cookie should have:
   - HttpOnly: ✅
   - Secure: ❌ (false for local development)
   - SameSite: Lax

### **Check Network Tab:**
1. Login
2. Watch Network tab
3. `POST /api/auth/login/user` → 200
4. `GET /api/auth/check` → 200, returns authenticated: true
5. Check Response for `/api/auth/check`:
   ```json
   {
     "authenticated": true,
     "userType": "admin",
     "userName": "Administrator",
     "userId": 2
   }
   ```

### **Check Console:**
- Should be NO errors
- Should be NO CORS errors
- Should be NO 401/403 errors

---

## 📞 Report Issues

If you find any issues, check:

1. **Container Status:**
   ```bash
   docker ps
   ```
   Both lavandaria-db and lavandaria-app should be "Up"

2. **Application Logs:**
   ```bash
   docker logs lavandaria-app --tail=50
   ```

3. **Browser Console:**
   - F12 → Console tab
   - Look for errors in red

4. **Network Tab:**
   - F12 → Network tab
   - Check failed requests (red)

---

## 🎉 Success Criteria

**All tests pass when:**
- ✅ All 4 user types can login
- ✅ All redirect to correct dashboard
- ✅ Role-based content shows correctly
- ✅ Password change works for everyone
- ✅ Sessions persist
- ✅ Logout works
- ✅ No console errors
- ✅ No 401/403 errors

---

**Testing Status:** ✅ Ready for browser testing
**Last Code Update:** 2025-10-01 22:50:00
**Issues Fixed:** All critical issues resolved
