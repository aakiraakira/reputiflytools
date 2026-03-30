# Google Review Automation Dashboard - Full Agent Context

**Project:** review-automation-dash
**Live URL:** https://review-automation-dash.web.app
**Owner:** Julian (realjuliantung@gmail.com) - Google Review agency in Singapore
**Last Updated:** 2026-03-30

---

## What This Is

A centralized dashboard that automates Julian's Google Review agency workflow:
- **Admin (Julian):** Creates orders for clients, generates AI reviews, assigns work to employees, tracks progress, sends TNC links, exports proof screenshots
- **Employee (Farhan):** Uploads proof screenshots of posted reviews, submits daily progress reports
- **Client (public, no login):** Signs TNC via shareable link, tracks order progress via permanent link

---

## Tech Stack

- **Frontend:** Vanilla JS single-page app (no framework), Tailwind CDN, Inter font
- **Backend:** Firebase Cloud Functions v2 (Express), Node 20, us-central1
- **Database:** Firestore (orders, users, signatures, dailyReports)
- **Storage:** Firebase Storage (proof screenshots as WebP)
- **Auth:** Firebase Auth (email/password)
- **AI:** Gemini API (3.1 Flash Lite = quality, 2.5 Flash Lite = quick)
- **Maps:** Google Places Autocomplete for business search
- **Local Cache:** IndexedDB for review text (zero Firestore cost)

---

## File Structure

```
google-review-automation/
├── .firebaserc                    # Project: review-automation-dash
├── firebase.json                  # Hosting rewrites: /tnc/**, /t/**, /api/**
├── firestore.rules                # Role-based access (admin/employee/public)
├── firestore.indexes.json
├── storage.rules                  # 5MB max, images only
├── functions/
│   ├── index.js                   # 665 lines - ALL API endpoints
│   ├── package.json               # firebase-admin, express, cors, jszip, resend
│   └── .env                       # GEMINI_KEY, GOOGLE_MAPS_KEY
├── public/
│   ├── index.html                 # 2,384 lines - ENTIRE dashboard
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker (has caching issues)
│   ├── tnc/index.html             # 289 lines - TNC e-signature page
│   ├── t/index.html               # 245 lines - Client tracking page
│   ├── tnc.html                   # Legacy redirect
│   └── track.html                 # Legacy redirect
└── CONTEXT.md                     # This file
```

---

## Firebase Config

```javascript
apiKey: "AIzaSyBKsPEjFq1QrKnavg6tIR4vRUFO3f8QsMs"
authDomain: "review-automation-dash.firebaseapp.com"
projectId: "review-automation-dash"
storageBucket: "review-automation-dash.firebasestorage.app"
messagingSenderId: "868503238911"
appId: "1:868503238911:web:ecc55148b2edc56fca34ca"
```

**API Base URL:** `https://api-5cggu5upia-uc.a.run.app`

---

## Accounts

| Email | Role | Password | Notes |
|-------|------|----------|-------|
| realjuliantung@gmail.com | admin | Julian2026! | Primary admin |
| farhan@reputifly.com | employee | Farhan2026! | Test employee |

**Notification email:** runikojane@gmail.com (TNC signing alerts)

---

## Cloud Functions Endpoints (functions/index.js)

### Public (No Auth)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/tnc-sign` | Submit TNC signature with forensic metadata + SHA-256 hash |
| GET | `/order-public/:orderId` | Fetch order data for TNC/tracking pages |

### Authenticated (Bearer token required)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/orders` | any | List orders (role-filtered) |
| POST | `/orders` | admin | Create order |
| DELETE | `/orders/:id` | admin | Delete order + subcollections |
| GET | `/orders/:id/reviews` | any | Get reviews (employees see only assigned) |
| POST | `/orders/:id/reviews` | admin | Batch push review texts |
| POST | `/orders/:id/assign` | admin | Assign reviews to employee |
| POST | `/orders/:id/proofs` | any | Upload proof screenshot |
| GET | `/orders/:id/export-proofs` | admin | Download all proofs as ZIP |
| POST | `/upload-proof` | any | Upload proof (alt endpoint) |
| POST | `/generate-reviews` | any | Generate reviews via Gemini AI |
| POST | `/create-employee` | admin | Create Firebase Auth + Firestore user |
| POST | `/reset-password` | admin | Reset employee password |
| POST | `/revoke-employee` | admin | Disable employee account |
| POST | `/daily-report` | any | Employee submits daily progress |
| GET | `/daily-reports` | admin | List all daily reports |
| POST | `/daily-report/:id/approve` | admin | Approve report, increment order counts |

### Scheduled
| Function | Schedule | Purpose |
|----------|----------|---------|
| `cleanupOldProofs` | Every 24h | Delete proof images for completed orders >30 days old |

---

## Firestore Collections

### `users/{uid}`
```
email, name, role ('admin'|'employee'|'revoked'), createdAt
```

### `orders/{orderId}`
```
companyName, placeId, reviewLink, quantity, dailyTarget,
completedCount, startingCount, status ('active'|'completed'|'paused'),
assignedEmployees[], tncSigned, tncSignatureId, clientTrackingToken,
comments, createdAt, updatedAt
```
**Subcollections:** `reviews/{reviewId}`, `proofs/{proofId}`

### `signatures/{signatureId}`
```
orderId, email, companyName, quantity, representativeName, signingName,
agreedToTnc, tncVersion, signedAt, signedAtIso,
userAgent, ip, screenResolution, language, platform, touchDevice,
consentTimestamp, scrolledToBottom, timezone, signatureHash (SHA-256),
tncTextSnapshot
```

### `dailyReports/{reportId}`
```
date, employeeId, employeeName,
entries: [{ orderId, companyName, reviewsClaimed, screenshotsCount, screenshotUrls }],
status ('pending_approval'|'approved'), submittedAt, approvedBy, approvedAt,
totalReviews, totalScreenshots
```

---

## Dashboard Tabs (public/index.html)

### Admin Tabs (8)
| Tab | ID | Purpose |
|-----|-----|---------|
| Orders | `orders` | Create/view orders with Google Places search, links, proofs |
| Tracker | `tracker` | Spreadsheet view - editable Daily/Done/Ordered/Start/Comments, sortable, filterable, bulk select + assign |
| Review Manager | `reviews` | IndexedDB-based review management (upload JSON, copy-paste, mark done) |
| AI Generator | `ai` | Generate 50 reviews via Gemini, download as JSON |
| Reports | `reports` | View/approve employee daily progress reports |
| Links | `links` | All TNC + tracking links at a glance, toggle TNC status |
| Employees | `employees` | Create/revoke/reset password for employees |
| Guide | `guide` | 6-step admin workflow guide |

### Employee Tabs (5)
| Tab | ID | Purpose |
|-----|-----|---------|
| My Tasks | `assignments` | View assigned companies with progress |
| Upload Proofs | `upload` | Batch screenshot upload per company + review count entry |
| Tracker | `tracker` | Read-only spreadsheet (can edit Done/Comments) |
| AI Generator | `ai` | Generate reviews (same as admin) |
| Guide | `guide` | Simple 6-step employee guide |

---

## Key App Methods (public/index.html)

### Rendering
`renderShell()` `renderOrders()` `renderOrderCard(o)` `renderTracker()` `renderReviewManager()` `renderAIGenerator()` `renderReports()` `renderReportCard(r)` `renderLinks()` `renderEmployees()` `renderGuide()` `renderAssignments()` `renderUploadProofs()` `renderLogin()`

### Data Loading
`loadOrders()` `loadEmployees()` `loadEmployeeAssignments()` `loadDailyReports()`

### Actions
`showNewOrderModal()` `showAssignModal(orderId)` `showBulkAssignModal(orderIds)` `showAddEmployeeModal()` `showProofGallery(orderId)` `showDailyReportModal()` `toggleTnc(orderId, value)`

### Utilities
`toast(msg, type)` `copyToClipboard(text, msg)` `downloadJSON(data, filename)` `compressImage(file, maxW, quality)` `sleep(ms)` `inferShortName(name)`

### IndexedDB
`IDB.open()` `IDB.get(id)` `IDB.getAll()` `IDB.put(item)` `IDB.delete(id)` `IDB.clear()`

---

## URL Routing

| URL | Page | Auth |
|-----|------|------|
| `/` | Dashboard (login or admin/employee view) | Firebase Auth |
| `/tnc/{orderId}` | TNC e-signature form | Public |
| `/t/{orderId}` | Client tracking page | Public |
| `/api/**` | Cloud Functions | Bearer token |

---

## Known Bugs (Priority Order)

1. **B5 (MEDIUM):** Service worker caches old files - need to clear SW on each deploy or remove entirely
2. **B2 (MEDIUM):** Employee tracker shows empty if no orders assigned - should show ALL orders read-only
3. **B3 (LOW):** Employee sees Assign/Delete buttons in tracker - need role-gating
4. **B4 (LOW):** Tab click handlers stack on re-render - use `onclick=` instead of `addEventListener`
5. **B1 (LOW):** Farhan's Firestore doc missing `name` field

---

## Env Variables (functions/.env)

```
GEMINI_KEY=AIzaSyCLQN4ZOZsfHJGkltekfAych80CSBqtdtw
GOOGLE_MAPS_KEY=AIzaSyBXdjRQZJd9ySH5mxql4tlXCEVpDH9GGbI
```

---

## Deploy Commands

```bash
# Full deploy (hosting + functions + rules)
cd google-review-automation
firebase deploy --only hosting,functions,firestore:rules --force

# Hosting only (fastest)
firebase deploy --only hosting

# Functions only
firebase deploy --only functions --force
```

---

## User Preferences

- **Theme:** White background, black Inter fonts, rounded corners (12px)
- **Mobile-first:** 100% of employee usage is mobile
- **AI Models:** Quality = gemini-3.1-flash-lite, Quick = gemini-2.5-flash-lite
- **Cost target:** ~$0/month (Firestore free tier, WebP compression for storage)
- **Email API:** Reputifly at asia-southeast1-b2b-software.cloudfunctions.net/reputifly
- **Copy-paste sheet format:** Tab-separated: Company\tDaily\tDone\tOrdered\tStart\tEnd\t\tLeft\tComments

---

## Critical Notes for New Agent

1. **The entire dashboard is ONE HTML file** (2,384 lines). All JS is inline. No build step.
2. **IndexedDB stores review texts locally** - this is intentional to avoid Firestore read costs.
3. **Service worker causes caching issues** - always clear SW after deploys or tell user to hard refresh.
4. **Firestore rules use nested get() for role checks** - this adds latency but is necessary for security.
5. **The Reputifly email API** at b2b-software is Julian's OTHER business - it sends TNC confirmation emails.
6. **Google Places Autocomplete is deprecated** (March 2025) but still works. Migration to PlaceAutocompleteElement is on the roadmap.
7. **Two Google Maps API keys exist** - one in .env (server-side), one in index.html (client-side for autocomplete).
8. **Julian has 1 employee and plans to stay small** - don't over-engineer employee features.
