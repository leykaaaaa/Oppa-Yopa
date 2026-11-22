'use strict';

/* =========================================================
   HELPERS
========================================================= */

const KEY = 'oppa_yopa_v1';
const SESSION = 'oppa_yopa_session';

const $ = (selector, root = document) =>
    root.querySelector(selector);

const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));

const uid = () =>
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);

const pad = number =>
    String(number).padStart(2, '0');

const peso = value => {
    const amount = Number(value || 0);
    const isWhole = Math.abs(amount - Math.round(amount)) < 0.005;

    return '₱' + amount.toLocaleString('en-PH', {
        minimumFractionDigits: isWhole ? 0 : 2,
        maximumFractionDigits: isWhole ? 0 : 2
    });
};

const toISO = date =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const todayStr = () =>
    toISO(new Date());

const curYM = () =>
    todayStr().slice(0, 7);

const addMonths = (yearMonth, amount) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + amount, 1);

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

const ymLabel = yearMonth => {
    const [year, month] = yearMonth.split('-').map(Number);

    return new Date(year, month - 1, 1).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric'
    });
};

const fmtDate = value => {
    if (!value) return '—';

    const date = new Date(
        value.length === 10
            ? `${value}T00:00:00`
            : value
    );

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const fmtShort = value => {
    const date = new Date(value);

    const options = date.getFullYear() === new Date().getFullYear()
        ? { month: 'short', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };

    return date.toLocaleDateString('en-US', options);
};

const hash = value => {
    let result = 5381;
    const string = 'be$' + value;

    for (let i = 0; i < string.length; i++) {
        result = ((result << 5) + result + string.charCodeAt(i)) | 0;
    }

    return 'h' + (result >>> 0).toString(36);
};

const randPass = () => {
    const characters = 'abcdefghjkmnpqrstuvwxyz23456789';
    let password = '';

    for (let i = 0; i < 8; i++) {
        password += characters[
            Math.floor(Math.random() * characters.length)
        ];
    }

    return password;
};

const slug = value =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.|\.$/g, '')
        .slice(0, 20);

const METHOD = {
    cash: 'Cash',
    gcash: 'GCash',
    bank: 'Bank transfer',
    deposit: 'Deposit applied'
};

const STATUS_LABEL = {
    paid: 'Paid',
    partial: 'Partial',
    overdue: 'Overdue',
    unpaid: 'Unpaid',
    upcoming: 'Upcoming',
    pending: 'Pending confirmation',
    confirmed: 'Confirmed',
    rejected: 'Rejected',
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
    movedout: 'Moved out',
    important: 'Important',
    new: 'New'
};

const badge = (status, label) => `
    <span class="badge ${status}">
        <i></i>${esc(label || STATUS_LABEL[status] || status)}
    </span>
`;


/* =========================================================
   DATA LAYER
========================================================= */

// Create initial demo data.
function seed() {
    const start = addMonths(curYM(), -2) + '-01';

    const room1 = {
        id: uid(),
        name: 'Room 1',
        capacity: 3,
        rate: 2500
    };

    const room2 = {
        id: uid(),
        name: 'Room 2',
        capacity: 3,
        rate: 2800
    };

    const owner = {
        id: uid(),
        username: 'owner',
        pass: hash('owner123'),
        role: 'owner',
        name: 'Boarding House Owner'
    };

    const tenantUser = {
        id: uid(),
        username: 'satoru',
        pass: hash('tenant123'),
        role: 'tenant',
        name: 'Gojo Satoru'
    };

    const tenant = {
        id: uid(),
        userId: tenantUser.id,
        name: 'Gojo Satoru',
        contact: '0917 000 0000',
        roomId: room1.id,
        rent: 2500,
        deposit: 2500,
        start,
        months: 12,
        dueDay: 5
    };

    const now = new Date().toISOString();

    const createPayment = (
        month,
        amount,
        method,
        reference,
        status
    ) => ({
        id: uid(),
        tenantId: tenant.id,
        month,
        amount,
        method,
        ref: reference,
        note: '',
        status,
        date: now,
        by: method === 'cash' ? 'owner' : 'tenant'
    });

    return {
        users: [owner, tenantUser],

        rooms: [room1, room2],

        tenants: [tenant],

        payments: [
            createPayment(
                addMonths(curYM(), -2),
                2500,
                'cash',
                '',
                'confirmed'
            ),

            createPayment(
                addMonths(curYM(), -1),
                1000,
                'gcash',
                '09171234567',
                'confirmed'
            )
        ],

        complaints: [],

        announcements: [
            {
                id: uid(),
                title: 'Welcome to Oppa Yopa',
                message: 'Notices from your owner will show up here.',
                priority: 'normal',
                roomId: null,
                date: now
            }
        ],

        settings: {
            boardName: 'Oppa Yopa Dorm',
            gcashName: '',
            gcashNumber: '',
            bankName: '',
            bankAcct: '',
            bankHolder: '',
            instructions: ''
        }
    };
}

// Load saved data or restore demo data.
function load() {
    try {
        const savedData = JSON.parse(localStorage.getItem(KEY));

        if (
            savedData &&
            Array.isArray(savedData.users) &&
            Array.isArray(savedData.rooms) &&
            Array.isArray(savedData.tenants)
        ) {
            savedData.payments = Array.isArray(savedData.payments)
                ? savedData.payments
                : [];

            savedData.complaints = Array.isArray(savedData.complaints)
                ? savedData.complaints
                : [];

            savedData.announcements = Array.isArray(savedData.announcements)
                ? savedData.announcements
                : [];

            savedData.settings = {
                boardName: 'Oppa Yopa Dorm',
                gcashName: '',
                gcashNumber: '',
                bankName: '',
                bankAcct: '',
                bankHolder: '',
                instructions: '',
                ...(savedData.settings || {})
            };

            savedData.users.forEach(user => {
                user.seenAnn = Array.isArray(user.seenAnn)
                    ? user.seenAnn
                    : [];
            });

            return savedData;
        }
    } catch (error) {
        console.warn(
            'Saved data could not be loaded. Demo data was restored.',
            error
        );
    }

    const demoData = seed();

    try {
        localStorage.setItem(KEY, JSON.stringify(demoData));
    } catch (error) {
        console.warn('Could not save demo data.', error);
    }

    return demoData;
}

// Save application data.
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

let db;
let me = null;

const ui = {
    page: 'dashboard',
    tq: '',
    tf: 'all',
    pq: '',
    pf: 'all',
    cf: 'all',
    payMonth: ''
};



// Get all months covered by a tenant's lease.
// A tenant who moved out is only charged up to the move-out month.
const monthsOf = tenant => {
    const all = Array.from(
        { length: tenant.months },
        (_, index) => addMonths(tenant.start.slice(0, 7), index)
    );

    if (!tenant.movedOut) {
        return all;
    }

    const last = tenant.movedOut.slice(0, 7);

    return all.filter(month => month <= last);
};

const DEPOSIT = {
    returned: 'Returned to tenant',
    applied: 'Applied to unpaid rent',
    kept: 'Kept by owner',
    none: 'No deposit'
};

// Find a room by its ID.
const roomOf = id =>
    db.rooms.find(room => room.id === id);

// Get a room's name.
const roomName = id =>
    (roomOf(id) || { name: '—' }).name;

// Find a tenant by ID.
const tenantOf = id =>
    db.tenants.find(tenant => tenant.id === id);

// Get the current user's tenant record.
const myTenant = () =>
    db.tenants.find(tenant => tenant.userId === me.id);

// Calculate the lease end date.
const leaseEnd = tenant => {
    const date = new Date(`${tenant.start}T00:00:00`);

    date.setMonth(date.getMonth() + Number(tenant.months));
    date.setDate(date.getDate() - 1);

    return toISO(date);
};

// Lease length in real days.
// Both the start and end dates are included.
const plural = (amount, word) =>
    `${amount} ${word}${amount === 1 ? '' : 's'}`;

const dayDiff = (start, end) =>
    Math.round(
        (
            new Date(`${end}T00:00:00`) -
            new Date(`${start}T00:00:00`)
        ) / 864e5
    );

// Calculate lease duration and remaining days.
function leaseDays(tenant) {
    const end = leaseEnd(tenant);
    const today = todayStr();
    const total = dayDiff(tenant.start, end) + 1;

    if (today < tenant.start) {
        return {
            state: 'upcoming',
            total,
            elapsed: 0,
            left: total,
            startsIn: dayDiff(today, tenant.start),
            endedAgo: 0
        };
    }

    if (today > end) {
        return {
            state: 'ended',
            total,
            elapsed: total,
            left: 0,
            startsIn: 0,
            endedAgo: dayDiff(end, today)
        };
    }

    const elapsed = dayDiff(tenant.start, today) + 1;

    return {
        state: 'active',
        total,
        elapsed,
        left: total - elapsed,
        startsIn: 0,
        endedAgo: 0
    };
}

// Get a short lease status.
function leaseShort(tenant) {
    if (tenant.movedOut) {
        return 'Moved out';
    }

    const lease = leaseDays(tenant);

    if (lease.state === 'active') {
        return `${plural(lease.left, 'day')} left`;
    }

    if (lease.state === 'upcoming') {
        return `Starts in ${plural(lease.startsIn, 'day')}`;
    }

    return 'Lease ended';
}

// Get detailed lease information.
function leaseDetail(tenant) {
    const lease = leaseDays(tenant);
    const percentage = Math.round(
        lease.elapsed / lease.total * 100
    );

    let description;

    if (lease.state === 'active') {
        description =
            `Day ${lease.elapsed} of ${lease.total} · ` +
            `${plural(lease.left, 'day')} left`;
    } else if (lease.state === 'upcoming') {
        description = `Starts in ${plural(lease.startsIn, 'day')}`;
    } else {
        description = `Ended ${plural(lease.endedAgo, 'day')} ago`;
    }

    if (tenant.movedOut) {
        description = `Moved out on ${fmtDate(tenant.movedOut)}`;
    }

    return `
        ${plural(lease.total, 'day')}
        (${plural(+tenant.months, 'month')})

        <div class="prog" aria-hidden="true">
            <i style="width:${percentage}%"></i>
        </div>

        <div class="muted small">
            ${description}
        </div>
    `;
}




// Get online payment methods configured by the owner.
function channels() {
    const settings = db.settings;
    const availableChannels = [];

    if ((settings.gcashNumber || '').trim()) {
        availableChannels.push('gcash');
    }

    if ((settings.bankAcct || '').trim()) {
        availableChannels.push('bank');
    }

    return availableChannels;
}




// Get payment information for a specific month.
function monthInfo(tenant, yearMonth) {
    const rent = +tenant.rent;

    const amounts = paymentAllocations(tenant)
        .byMonth
        .get(yearMonth) || {
            paid: 0,
            pending: 0,
            methods: []
        };

    const paid = amounts.paid;
    const pending = amounts.pending;

    const balance = Math.max(
        +(rent - paid).toFixed(2),
        0
    );

    const due = `${yearMonth}-${pad(Math.min(+tenant.dueDay, 28))}`;

    let status;

    if (balance <= 0) {
        status = 'paid';
    } else if (todayStr() > due) {
        status = 'overdue';
    } else if (paid > 0) {
        status = 'partial';
    } else if (yearMonth > curYM()) {
        status = 'upcoming';
    } else {
        status = 'unpaid';
    }

    return {
        ym: yearMonth,
        rent,
        paid,
        pending,
        balance,
        due,
        status,
        methods: amounts.methods,
        partial: paid > 0 && balance > 0
    };
}

// Allocate confirmed and pending payments across lease months.
function paymentAllocations(tenant) {
    const months = monthsOf(tenant);

    const totals = new Map(
        months.map(month => [
            month,
            {
                paid: 0,
                pending: 0,
                methods: new Set()
            }
        ])
    );

    const remaining = new Map(
        months.map(month => [month, +tenant.rent])
    );

    const payments = db.payments
        .filter(payment =>
            payment.tenantId === tenant.id &&
            ['confirmed', 'pending'].includes(payment.status) &&
            months.includes(payment.month)
        )
        .sort((a, b) =>
            a.date.localeCompare(b.date) ||
            a.id.localeCompare(b.id)
        );

    const allocations = new Map();

    payments.forEach(payment => {
        let amount = Math.max(
            Number(payment.amount) || 0,
            0
        );

        const allocation = {
            unapplied: amount
        };

        const targetIndex = months.indexOf(payment.month);

        const allocationOrder = [
            payment.month,
            ...months.filter((_, index) => index !== targetIndex)
        ];

        for (const month of allocationOrder) {
            if (amount <= 0) break;

            const available = remaining.get(month);
            const applied = Math.min(amount, available);

            if (applied <= 0) continue;

            remaining.set(
                month,
                +(available - applied).toFixed(2)
            );

            amount = +(amount - applied).toFixed(2);

            const total = totals.get(month);

            const bucket = payment.status === 'confirmed'
                ? 'paid'
                : 'pending';

            total[bucket] = +(total[bucket] + applied).toFixed(2);

            if (payment.status === 'confirmed') {
                total.methods.add(payment.method);
            }
        }

        allocation.unapplied = amount;
        allocations.set(payment.id, allocation);
    });

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
        ),

        byPayment: allocations
    };
}

// Get the overall rent status of a tenant.
function tenantStatus(tenant) {
    const currentMonth = curYM();

    const infos = monthsOf(tenant)
        .filter(month => month <= currentMonth)
        .map(month => monthInfo(tenant, month));

    const hasStatus = status =>
        infos.some(info => info.status === status);

    let status = !infos.length
        ? 'upcoming'
        : hasStatus('overdue')
            ? 'overdue'
            : hasStatus('partial')
                ? 'partial'
                : hasStatus('unpaid')
                    ? 'unpaid'
                    : 'paid';

    if (tenant.movedOut) {
        status = 'movedout';
    }

    return {
        status,
        balance: infos.reduce(
            (total, info) => total + info.balance,
            0
        ),
        partial: infos.some(info => info.partial),
        infos
    };
}

// Generate payment status badges.
const infoBadge = info =>
    badge(
        info.status,
        info.status === 'overdue' && info.partial
            ? 'Overdue (partial)'
            : null
    );

const statusBadge = status =>
    status.status === 'movedout'
        ? (status.balance > 0
            ? badge('overdue', `Moved out · owes ${peso(status.balance)}`)
            : badge('movedout'))
        : badge(
        status.status,
        status.status === 'overdue' && status.partial
            ? 'Overdue (partial)'
            : null
    );

// Get the remaining payable amount for a month.
const availFor = (tenant, yearMonth) => {
    const allocation = paymentAllocations(tenant)
        .byMonth
        .get(yearMonth);

    return allocation
        ? Math.max(allocation.remaining, 0)
        : 0;
};

// Get the maximum payable amount starting from a month.
const maxPayableFrom = (tenant, yearMonth) => {
    const allocations = paymentAllocations(tenant).byMonth;
    const months = monthsOf(tenant);

    if (!months.includes(yearMonth)) return 0;

    const total = months.reduce(
        (sum, month) =>
            sum + (
                allocations.get(month) || { remaining: 0 }
            ).remaining,
        0
    );

    return +total.toFixed(2);
};

// Generate month options for a payment form.
function monthOptions(tenant, selectedMonth) {
    const options = monthsOf(tenant)
        .map(month => {
            const available = availFor(tenant, month);

            if (available <= 0) return '';

            return `
                <option
                    value="${month}"
                    ${month === selectedMonth ? 'selected' : ''}
                >
                    ${ymLabel(month)} — ${peso(available)} payable
                </option>
            `;
        })
        .join('');

    return options || `
        <option value="">
            No months left to pay
        </option>
    `;
}


/* =========================================================
   UI UTILITIES
========================================================= */

// Display a temporary notification.
function toast(message, isError = false) {
    const element = document.createElement('div');

    element.className = 'toast' + (isError ? ' err' : '');
    element.textContent = message;

    $('#toast').appendChild(element);

    setTimeout(() => element.remove(), 3200);
}

// Open a dialog.
function openDlg(title, body, wide = false) {
    const dialog = $('#dlg');

    dialog.className = wide ? 'wide' : '';
    dialog.setAttribute('aria-label', title);

    dialog.innerHTML = `
        <div class="dlg-head">
            <h3>${esc(title)}</h3>

            <button
                class="x"
                data-close
                aria-label="Close"
            >
                ×
            </button>
        </div>

        <div class="dlg-body">
            ${body}
        </div>
    `;

    labelTables(dialog);

    if (!dialog.open) {
        dialog.showModal();
    }
}

// Close the dialog.
const closeDlg = () => {
    const dialog = $('#dlg');

    if (dialog.open) {
        dialog.close();
    }
};

// Add column labels to table cells for responsive layouts.
function labelTables(root) {
    if (!root || !root.querySelectorAll) return;

    root.querySelectorAll('table').forEach(table => {
        const headers = [
            ...table.querySelectorAll('thead th')
        ].map(header => header.textContent.trim());

        table.classList.add('resp');

        table.querySelectorAll('tbody tr').forEach(row => {
            [...row.children].forEach((cell, index) => {
                if (
                    cell.dataset.label !== undefined ||
                    cell.classList.contains('nolabel')
                ) {
                    return;
                }

                if (headers[index]) {
                    cell.dataset.label = headers[index];

                    cell.innerHTML = `
                        <div class="cv">
                            ${cell.innerHTML}
                        </div>
                    `;
                } else {
                    cell.classList.add('nolabel');
                }
            });
        });
    });
}

// Render an empty-state message.
function empty(message) {
    return `
        <div class="empty">
            ${esc(message)}
        </div>
    `;
}


/* =========================================================
   AUTHENTICATION
========================================================= */

// Log in a user.
function login(formData) {
    const username = formData.username.trim().toLowerCase();

    const user = db.users.find(
        item => item.username === username
    );

    if (!user || user.pass !== hash(formData.password)) {
        return toast('Wrong username or password.', true);
    }

    const record = user.role === 'tenant'
        ? db.tenants.find(item => item.userId === user.id)
        : null;

    if (user.disabled || (record && record.movedOut)) {
        return toast(
            'This account is no longer active. Please ask your owner.',
            true
        );
    }

    const previousLogin = user.lastLogin || null;

    me = user;

    localStorage.setItem(SESSION, user.id);

    ui.page = user.role === 'owner'
        ? 'dashboard'
        : 'lease';

    render();

    showWelcome(previousLogin);

    user.lastLogin = new Date().toISOString();

    save();
}

// Log out the current user.
function logout() {
    me = null;

    localStorage.removeItem(SESSION);

    render();
}


/* =========================================================
   LOGIN VIEW
========================================================= */

function loginView() {
    const sample = [
        'paid',
        'paid',
        'paid',
        'paid',
        'partial',
        'paid',
        'paid',
        'overdue',
        'paid',
        'paid',
        'unpaid',
        'upcoming'
    ];

    return `
        <div class="login">

            <section class="login-art">

                <div class="brand">
                    ${LOGO}

                    <div>
                        <b>Oppa Yopa</b>
                    </div>
                </div>

                <div>
                    <h1>
                        Know if your 'Oppa' has been paid or not.
                    </h1>

                    <p>
                        Rent, leases and tenant reports for your
                        boarding house, in one place.
                    </p>

                    <span class="strip big" aria-hidden="true">
                        ${sample.map(status => `
                            <i class="m ${status}"></i>
                        `).join('')}
                    </span>
                </div>

                <small>
                    Records are saved in this browser.
                </small>

            </section>

            <form class="login-form" data-form="login">

                <h2>Sign in</h2>

                <p class="muted">
                    Tenants: use the login your owner gave you.
                </p>

                <div class="field">
                    <label for="lu">Username</label>

                    <input
                        id="lu"
                        name="username"
                        autocomplete="username"
                        required
                        autofocus
                    >
                </div>

                <div class="field">
                    <label for="lp">Password</label>

                    <input
                        id="lp"
                        name="password"
                        type="password"
                        autocomplete="current-password"
                        required
                    >
                </div>

                <button class="btn primary block">
                    Sign in
                </button>

                <details class="demo" open>
                    <summary>Demo accounts</summary>

                    <p>
                        Owner:
                        <code>owner</code> /
                        <code>owner123</code>
                        <br>

                        Tenant:
                        <code>satoru</code> /
                        <code>tenant123</code>
                    </p>
                </details>

            </form>

        </div>
    `;
}