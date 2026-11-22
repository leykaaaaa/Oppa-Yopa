# Oppa Yopa

Oppa Yopa is a browser-based boarding house rent tracker for owners and tenants. It includes tenant and room management, monthly lease calendars, rent payment approval, maintenance reports, announcements, and password management.

<<<<<<< HEAD
The application is written in plain HTML, CSS, and JavaScript. It has no build step or backend; data is stored in the browser with `localStorage`.

## Features

### Owner

- View monthly collection totals and outstanding balances
- Add, edit, view, and remove tenants
- Create tenant login credentials
- Add and remove rooms
- Record cash or online payments
- Confirm, reject, or void payments
- Read and respond to tenant reports
- Post all-tenant or room-specific announcements
- Configure GCash, bank, and boarding house details
- Export all application data as JSON
- Reset the demo data

### Tenant

- View lease dates and remaining lease time
- View rent status for each lease month
- Submit cash, GCash, or bank payments
- View pending, confirmed, and rejected payments
- Read announcements and report items as seen
- Submit maintenance or concern reports
- Change the account password

## Run the Project

No installation is required.

1. Open `index.html` in a browser, or
2. Serve the project with a local static server:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

The demo owner account is:

- Username: `owner`
- Password: `owner123`

Demo data is created automatically the first time the application loads. Resetting the application from **Settings** removes the saved data and restores the demo data.

## Project Structure

```text
index.html          Application shell and script loading order
style.css           Responsive layout and component styles
js/core.js          Utilities, persistence, authentication, and rent calculations
js/layout.js        Navigation, shell rendering, and calendar components
js/pages.js         Owner and tenant page HTML
js/announcements.js Announcement filtering and announcement pages
js/handlers.js      Forms, actions, delegated events, and live searches
js/app.js           Loads data and starts the application
app.js              Compact standalone script copy
```

The scripts in `index.html` must load in this order:

```html
<script src="js/core.js"></script>
<script src="js/layout.js"></script>
<script src="js/pages.js"></script>
<script src="js/announcements.js"></script>
<script src="js/handlers.js"></script>
<script src="js/app.js"></script>
```

The modular files are the active application. `app.js` in the project root is a standalone/legacy copy and is not loaded by `index.html`.

# Key JavaScript Implementations

## 1. Application Startup

The application starts with `js/app.js`. It restores the saved database, restores the signed-in user from `localStorage`, selects the correct starting page, and performs the initial render.

```javascript
'use strict';

db = load();

me = db.users.find(
    user => user.id === localStorage.getItem(SESSION)
) || null;

if (me) {
    ui.page = me.role === 'owner' ? 'dashboard' : 'lease';
}

render();
```

- `load()` reads the saved database or creates demo data.
- `SESSION` stores the current user's ID.
- The user role determines the first page.
- `render()` builds and inserts the complete page interface.

## 2. Browser Data Persistence

`js/core.js` uses two `localStorage` keys:

| Key | Purpose |
|---|---|
| `oppa_yopa_v1` | Users, rooms, tenants, payments, reports, announcements, and settings |
| `oppa_yopa_session` | ID of the signed-in user |

```javascript
const KEY = 'oppa_yopa_v1';
const SESSION = 'oppa_yopa_session';

function load() {
    try {
        const savedData = JSON.parse(
            localStorage.getItem(KEY)
        );

        if (
            savedData &&
            Array.isArray(savedData.users) &&
            Array.isArray(savedData.rooms) &&
            Array.isArray(savedData.tenants)
        ) {
            savedData.payments =
                Array.isArray(savedData.payments)
                    ? savedData.payments
                    : [];
            savedData.complaints =
                Array.isArray(savedData.complaints)
                    ? savedData.complaints
                    : [];
            savedData.announcements =
                Array.isArray(savedData.announcements)
                    ? savedData.announcements
                    : [];

            return savedData;
        }
    } catch (error) {
        console.warn(
            'Saved data could not be loaded. Demo data was restored.',
            error
        );
    }

    const demoData = seed();
    localStorage.setItem(KEY, JSON.stringify(demoData));
    return demoData;
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
        return true;
    } catch (error) {
        console.warn('Could not save changes.', error);
        toast('Changes could not be saved in this browser.', true);
        return false;
    }
}
```

Every mutation calls `save()`, while `render()` refreshes the interface. This is a simple in-browser state system without a database server.

## 3. Authentication

The login handler compares the entered username and a generated password hash.

```javascript
function login(formData) {
    const user = db.users.find(
        candidate =>
            candidate.username ===
            formData.username.trim().toLowerCase()
    );

    if (!user || user.pass !== hash(formData.password)) {
        return toast(
            'Wrong username or password.',
            true
        );
    }

    me = user;
    localStorage.setItem(SESSION, user.id);
    ui.page = user.role === 'owner' ? 'dashboard' : 'lease';

    save();
    render();
}

function logout() {
    me = null;
    localStorage.removeItem(SESSION);
    render();
}
```

The hash is used only for this frontend demo:

```javascript
const hash = value => {
    let result = 5381;
    const string = 'be$' + value;

    for (let i = 0; i < string.length; i++) {
        result =
            ((result << 5) + result + string.charCodeAt(i)) |
            0;
    }

    return 'h' + (result >>> 0).toString(36);
};
```

This is not suitable as a production password-security implementation because browser storage is accessible to the browser and users. A deployed application should use a server, password-hashing library, secure session cookies, and role-based authorization.

## 4. Navigation and Page Rendering

`render()` checks the signed-in role, validates the requested page, generates the page HTML, and replaces the application shell.

```javascript
function render() {
    const app = $('#app');

    if (!me) {
        app.innerHTML = loginView();
        return;
    }

    const nav = me.role === 'owner'
        ? OWNER_NAV
        : TENANT_NAV;

    if (!nav.some(item => item[0] === ui.page)) {
        ui.page = nav[0][0];
    }

    const pages = {
        dashboard: pgDashboard,
        tenants: pgTenants,
        rooms: pgRooms,
        payments: pgPayments,
        complaints: pgComplaints,
        announce: pgAnnounce,
        notices: pgNotices,
        settings: pgSettings,
        lease: pgLease,
        pay: pgPay,
        history: pgHistory,
        reports: pgReports,
        account: pgAccount
    };

    app.innerHTML = layoutHTML(
        pages[ui.page]()
    );
}
```

The navigation button handler updates `ui.page` and calls `render()` again:

```javascript
const actions = {
    nav: data => {
        ui.page = data.id;
        render();
    }
};
```

## 5. Lease and Rent Status Calculations

Each tenant can cover a selected number of months. `monthsOf()` generates all year-month values in the lease.

```javascript
const monthsOf = tenant =>
    Array.from(
        { length: tenant.months },
        (_, index) =>
            addMonths(
                tenant.start.slice(0, 7),
                index
            )
    );
```

For one month, `monthInfo()` calculates paid amount, pending amount, balance, due date, and status.

```javascript
function monthInfo(tenant, yearMonth) {
    const rent = Number(tenant.rent);

    const allocation =
        paymentAllocations(tenant)
            .byMonth
            .get(yearMonth) || {
                paid: 0,
                pending: 0
            };

    const balance = Math.max(
        +(rent - allocation.paid).toFixed(2),
        0
    );

    const due =
        `${yearMonth}-${pad(
            Math.min(Number(tenant.dueDay), 28)
        )}`;

    let status;

    if (balance <= 0) {
        status = 'paid';
    } else if (todayStr() > due) {
        status = 'overdue';
    } else if (allocation.paid > 0) {
        status = 'partial';
    } else if (yearMonth > curYM()) {
        status = 'upcoming';
    } else {
        status = 'unpaid';
    }

    return {
        ym: yearMonth,
        rent,
        paid: allocation.paid,
        pending: allocation.pending,
        balance,
        due,
        status,
        partial: allocation.paid > 0 && balance > 0
    };
}
```

The date is deliberately limited to day 28. This prevents invalid due dates in February and shorter months.

## 6. Payment Allocation

Each payment can pay the selected month first and then remaining lease months. The allocation logic supports tenant overpayment and partial rent payment.

```javascript
function paymentAllocations(tenant) {
    const months = monthsOf(tenant);

    const remaining = new Map(
        months.map(month => [
            month,
            Number(tenant.rent)
        ])
    );

    const totals = new Map(
        months.map(month => [
            month,
            { paid: 0, pending: 0, methods: new Set() }
        ])
    );

    const payments = db.payments
        .filter(payment =>
            payment.tenantId === tenant.id &&
            ['confirmed', 'pending'].includes(
                payment.status
            ) &&
            months.includes(payment.month)
        )
        .sort((a, b) =>
            a.date.localeCompare(b.date) ||
            a.id.localeCompare(b.id)
        );

    for (const payment of payments) {
        let amount = Math.max(
            Number(payment.amount) || 0,
            0
        );

        const targetIndex =
            months.indexOf(payment.month);

        const allocationOrder = [
            payment.month,
            ...months.filter(
                (_, index) => index !== targetIndex
            )
        ];

        for (const month of allocationOrder) {
            if (amount <= 0) break;

            const available =
                remaining.get(month);
            const applied =
                Math.min(amount, available);

            if (applied <= 0) continue;

            remaining.set(
                month,
                +(available - applied).toFixed(2)
            );
            amount =
                +(amount - applied).toFixed(2);

            const total = totals.get(month);
            const bucket =
                payment.status === 'confirmed'
                    ? 'paid'
                    : 'pending';

            total[bucket] =
                +(total[bucket] + applied).toFixed(2);
        }
    }

    return {
        byMonth: new Map(
            [...totals].map(([month, total]) => [
                month,
                {
                    paid: total.paid,
                    pending: total.pending,
                    methods: [...total.methods],
                    remaining: remaining.get(month)
                }
            ])
        )
    };
}
```

Pending payments are included in availability calculations, but they are not counted as confirmed rent until the owner approves them.

## 7. Payment Submission

`submitPayment()` validates the tenant, lease month, amount, payment channel, and reference number before creating a payment.

```javascript
function submitPayment(formData, isOwner) {
    const tenant = tenantOf(formData.tenantId);
    const amount = Number(formData.amount);

    if (
        !tenant ||
        !monthsOf(tenant).includes(formData.month)
    ) {
        return toast(
            'Choose a valid lease month to pay.',
            true
        );
    }

    const maximum =
        maxPayableFrom(tenant, formData.month);

    if (!(amount > 0) || amount > maximum + 0.001) {
        return toast(
            `Amount must be between ₱1 and ${peso(maximum)}.`,
            true
        );
    }

    db.payments.push({
        id: uid(),
        tenantId: tenant.id,
        month: formData.month,
        amount,
        method: formData.method,
        ref: formData.ref.trim(),
        note: formData.note.trim(),
        status: isOwner ? 'confirmed' : 'pending',
        date: new Date().toISOString(),
        by: isOwner ? 'owner' : 'tenant'
    });

    save();
    closeDlg();
    render();
}
```

Owner-recorded payments are immediately confirmed. Tenant submissions are pending until the owner confirms or rejects them.

## 8. Event Delegation

Instead of attaching individual handlers to every button and form, the application listens at the `document` level.

```javascript
document.addEventListener('click', event => {
    if (event.target.closest('[data-close]')) {
        return closeDlg();
    }

    const element =
        event.target.closest('[data-action]');

    if (!element) return;

    const action =
        actions[element.dataset.action];

    if (action) {
        action(element.dataset);
    }
});
```

Buttons provide the action name and any required ID:

```html
<button
    class="btn sm"
    data-action="editTenant"
    data-id="tenant-id"
>
    Edit
</button>
```

Forms are submitted through the `data-form` attribute:

```javascript
document.addEventListener('submit', event => {
    const name = event.target.dataset.form;

    if (!name) return;

    event.preventDefault();

    const formData = Object.fromEntries(
        new FormData(event.target)
    );

    if (forms[name]) {
        forms[name](formData, event.target);
    }
});
```

This design keeps generated HTML and event handling separate.

## 9. Announcements and Unread Tracking

An announcement with no room ID is visible to every tenant. An announcement with a room ID is visible only to tenants in that room.

```javascript
const annFor = tenant =>
    db.announcements
        .filter(announcement =>
            !announcement.roomId ||
            announcement.roomId === tenant.roomId
        )
        .sort((a, b) =>
            b.date.localeCompare(a.date)
        );
```

Unread announcements are found by comparing announcement IDs with `seenAnn` stored on the current user:

```javascript
function unreadAnn() {
    const tenant = me && myTenant();

    if (!tenant) return [];

    const seen = me.seenAnn || [];

    return annFor(tenant).filter(
        announcement =>
            !seen.includes(announcement.id)
    );
}
```

Announcement text is escaped before inserted line breaks are converted to `<br>` elements:

```javascript
const annBody = message =>
    esc(message).replace(/\n/g, '<br>');
```

## 10. Safe HTML Rendering

Values that originate from users are escaped before they are placed inside HTML strings.

```javascript
const esc = value =>
    String(value ?? '').replace(
        /[&<>"']/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character])
    );
```

This prevents stored names, messages, usernames, and payment notes from being interpreted as executable HTML.

## 11. Responsive Table Labels

On small screens, tables become card-like rows. `labelTables()` reads each table header and stores the label on every matching cell.

```javascript
function labelTables(root) {
    if (!root || !root.querySelectorAll) return;

    root.querySelectorAll('table').forEach(table => {
        const heads = [
            ...table.querySelectorAll('thead th')
        ].map(header =>
            header.textContent.trim()
        );

        table.classList.add('resp');

        table
            .querySelectorAll('tbody tr')
            .forEach(row => {
                [...row.children].forEach(
                    (cell, index) => {
                        if (heads[index]) {
                            cell.dataset.label =
                                heads[index];
                        }
                    }
                );
            });
    });
}
```

The CSS can then display `data-label` beside each cell on narrow screens.

### Event and DOM Specification

The application uses delegated events on `document`, so handlers continue to work for HTML generated or replaced during `render()` and `refreshRows()` calls.

| Event | DOM target | Behavior |
| --- | --- | --- |
| `click` | `[data-close]` | Closes the active dialog. |
| `click` | `#dlg` | Closes the dialog when its backdrop is clicked. |
| `click` | `[data-action]` | Calls the matching function in `actions` using the element's `dataset`. |
| `submit` | `form[data-form]` | Prevents the browser submission and calls the matching function in `forms` with `FormData`. |
| `input` | `[data-live]` | Stores the live filter value in `ui` and refreshes table or card rows. |
| `change` | `[data-live]` | Applies a live filter value after a selection changes. |
| `change` | `#tf-room` | Fills `#tf-rent` with the selected room's rate. |
| `change` | `#pf-t` / `#pf-m` / `[name="method"]` | Updates payment month options, amount, reference field, and payment UI state. |

Action elements use `data-action` to identify a handler and optional `data-*` attributes for values such as a record ID:

```html
<button data-action="editTenant" data-id="tenant-id">
    Edit
</button>
```

Common action names include `nav`, `goto`, `addTenant`, `editTenant`, `viewTenant`, `delTenant`, `resetPw`, `delRoom`, `recordPay`, `confirmPay`, `rejectPay`, `voidPay`, `respond`, `payNow`, `backup`, `resetAll`, `logout`, `copy`, and `delAnn`.

Generated forms use `data-form` as the dispatch name:

```html
<form data-form="editTenant">
    <!-- Named inputs are converted to an object with FormData. -->
</form>
```

The form names are `login`, `addTenant`, `editTenant`, `ownerPay`, `tenantPay`, `addRoom`, `announce`, `complaint`, `respond`, `settings`, `rejectPayment`, and `changePw`.

Important DOM containers and controls include:

- `#app` - root application content rendered by `render()`.
- `#main` - primary page content inside the application layout.
- `#dlg` - the native `<dialog>` used for forms and detail views.
- `#toast` - live status and error notifications.
- `#rows` - tenant, payment, or complaint rows replaced by `refreshRows()`.
- `[data-live]` - live search and filter controls.
- `[data-action]` - delegated action buttons and clickable rows.
- `[data-form]` - forms handled by the delegated `submit` listener.
- `[data-close]` - buttons or controls that close a dialog.

# Data Model

The in-memory database is an object named `db`.

```text
db.users
db.rooms
db.tenants
db.payments
db.complaints
db.announcements
db.settings
```

## Main Relationships

```text
User <-> Tenant
Tenant -> Room
Tenant -> Payments
Tenant -> Complaints
Announcement -> Room or All Tenants
```

Example tenant record:

```javascript
{
    id: 'tenant-id',
    userId: 'user-id',
    name: 'Juan Dela Cruz',
    contact: '09123456789',
    roomId: 'room-id',
    rent: 2500,
    deposit: 500,
    start: '2026-01-01',
    months: 12,
    dueDay: 5
}
```

Example payment record:

```javascript
{
    id: 'payment-id',
    tenantId: 'tenant-id',
    month: '2026-01',
    amount: 2500,
    method: 'gcash',
    ref: 'GCASH-12345',
    note: '',
    status: 'pending',
    date: '2026-01-03T08:30:00.000Z',
    by: 'tenant'
}
```

# Security and Storage Notes

- Data belongs to the current browser and is not synchronized across devices.
- Clearing browser data removes the application database.
- The backup feature exports `db` as JSON.
- Password data is stored locally and is not production-grade authentication.
- This project is suitable for a local demo or prototype. Production use requires a backend, authentication, authorization, server-side validation, encrypted transport, and a database.
=======
Clean the Structure of the code

Changes some part of the announcement for Tenants.
>>>>>>> 84139ab21f90441f25e22bad942830fce13a91ce
