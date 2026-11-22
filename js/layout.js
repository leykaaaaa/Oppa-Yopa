'use strict';

/* =====================================================================
   ICONS AND LOGO
   ===================================================================== */

const ICONS = {
    dashboard: `
        <rect x="3" y="3" width="7" height="8" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="15" width="7" height="6" rx="1.5"/>
    `,
    tenants: '<i class="fa-solid fa-users" aria-hidden="true"></i>',
    rooms: '<i class="fa-solid fa-house" aria-hidden="true"></i>',
    payments: '<i class="fa-solid fa-wallet" aria-hidden="true"></i>',
    complaints: '<i class="fa-solid fa-message" aria-hidden="true"></i>',
    announce: '<i class="fa-solid fa-bullhorn" aria-hidden="true"></i>',
    settings: '<i class="fa-solid fa-sliders" aria-hidden="true"></i>',
    lease: '<i class="fa-solid fa-file-lines" aria-hidden="true"></i>',
    pay: '<i class="fa-solid fa-money-bill" aria-hidden="true"></i>',
    history: '<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>',
    account: '<i class="fa-solid fa-circle-user" aria-hidden="true"></i>',
    logout: '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>'
};

ICONS.notices = ICONS.announce;
ICONS.reports = ICONS.complaints;

const ico = name => {
    const icon = ICONS[name] || '';

    if (icon.startsWith('<i ')) {
        return icon;
    }

    return `
        <svg
            class="ico"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            ${icon}
        </svg>
    `;
};

const LOGO = `
    <svg
        class="logo"
        viewBox="0 0 32 32"
        aria-hidden="true"
    >
        <rect
            width="32"
            height="32"
            rx="8"
            fill="currentColor"
        />

        <rect
            x="7"
            y="9"
            width="5"
            height="14"
            rx="1.5"
            fill="#0038a8"
        />

        <rect
            x="13.5"
            y="9"
            width="5"
            height="14"
            rx="1.5"
            fill="#fcd116"
        />

        <rect
            x="20"
            y="9"
            width="5"
            height="14"
            rx="1.5"
            fill="#ce1126"
        />
    </svg>
`;

const initials = name =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();


/* =====================================================================
   PAYMENT HISTORY STRIP
   One bar per month for quick payment status overview.
   ===================================================================== */

// Short month label for the tiles, e.g. "2026-09" -> "Sep".
const monthShort = ym => {
    const [year, month] = ym.split('-').map(Number);

    return new Date(year, month - 1, 1).toLocaleString('en-US', {
        month: 'short'
    });
};

function stripHTML(tenant, max = 6) {
    const now = curYM();

    const infos = monthsOf(tenant)
        .filter(month => month <= now)
        .map(month => monthInfo(tenant, month))
        .slice(-max);

    if (!infos.length) {
        return '<span class="muted small">Not started</span>';
    }

    const describeMonth = info => {
        const paidText = info.paid > 0
            ? `, ${peso(info.paid)} of ${peso(info.rent)} paid`
            : '';

        const balanceText = info.balance > 0
            ? `, ${peso(info.balance)} left`
            : '';

        return `${ymLabel(info.ym)}: ${STATUS_LABEL[info.status]}${paidText}${balanceText}`;
    };

    const description = infos
        .map(describeMonth)
        .join('. ');

    // Labelled tiles. The status symbol is drawn by CSS (.mt::after),
    // so colour is never the only cue.
    const bars = infos.map(info => `
        <span
            class="mt ${info.status}"
            title="${esc(describeMonth(info))}"
        >${monthShort(info.ym)}</span>
    `).join('');

    return `
        <span
            class="strip labelled"
            role="img"
            aria-label="${esc(description)}"
        >
            ${bars}
        </span>
    `;
}

const legendHTML = () => `
    <div class="legend-row">
        ${[
            ['paid', 'Paid'],
            ['partial', 'Partial'],
            ['unpaid', 'Unpaid'],
            ['overdue', 'Overdue']
        ].map(([key, label]) => `
            <span class="lg">
                <span class="mt ${key}" aria-hidden="true"></span>
                ${label}
            </span>
        `).join('')}
    </div>
`;


/* =====================================================================
   LEASE CALENDAR
   Month tiles for the entire lease.
   Tenants can select a tile to pay for that month.
   ===================================================================== */

function calendarHTML(tenant, pay) {
    const now = curYM();

    const months = monthsOf(tenant).map(month => {
        const info = monthInfo(tenant, month);
        const [year, monthNumber] = month.split('-').map(Number);

        const monthName = new Date(
            year,
            monthNumber - 1,
            1
        ).toLocaleString('en-US', {
            month: 'short'
        });

        const subtitle = info.status === 'paid'
            ? 'Paid'
            : info.status === 'upcoming'
                ? peso(info.rent)
                : `${peso(info.balance)} left`;

        const label = `${ymLabel(month)}: ${STATUS_LABEL[info.status]}${info.balance > 0 ? ', ' + peso(info.balance) + ' left' : ''}`;

        const inner = `
            <span class="mn">${monthName}</span>
            <span class="my">${year}</span>
            <span class="ms">${subtitle}</span>
        `;

        const className = `mo ${info.status}${month === now ? ' now' : ''}`;

        if (pay && availFor(tenant, month) > 0) {
            return `
                <button
                    class="${className}"
                    data-action="payNow"
                    data-ym="${month}"
                    title="${esc(label)}. Select to pay."
                >
                    ${inner}
                </button>
            `;
        }

        return `
            <div
                class="${className}"
                title="${esc(label)}"
            >
                ${inner}
            </div>
        `;
    }).join('');

    return `<div class="cal">${months}</div>`;
}


/* =====================================================================
   NAVIGATION
   ===================================================================== */

const OWNER_NAV = [
    ['dashboard', 'Dashboard'],
    ['tenants', 'Tenants'],
    ['rooms', 'Rooms'],
    ['payments', 'Payments'],
    ['complaints', 'Reports'],
    ['announce', 'Announcements'],
    ['settings', 'Settings']
];

const TENANT_NAV = [
    ['lease', 'My lease'],
    ['notices', 'Announcements'],
    ['pay', 'Pay rent'],
    ['history', 'My payments'],
    ['reports', 'Send a report'],
    ['account', 'Account']
];


/* =====================================================================
   NAVIGATION COUNTS
   ===================================================================== */

function navCount(id) {
    if (id === 'payments') {
        return db.payments.filter(
            payment => payment.status === 'pending'
        ).length;
    }

    if (id === 'complaints') {
        return db.complaints.filter(
            complaint => complaint.status === 'open'
        ).length;
    }

    if (id === 'notices') {
        return unreadAnn().length;
    }

    return 0;
}


/* =====================================================================
   MAIN APPLICATION RENDER
   ===================================================================== */

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

    // Build the page first so unread badges are current.
    const content = pages[ui.page]();

    const navigation = nav.map(([id, label]) => {
        const count = navCount(id);
        const active = ui.page === id;

        return `
            <button
                class="nav-btn ${active ? 'active' : ''}"
                data-action="nav"
                data-id="${id}"
                ${active ? 'aria-current="page"' : ''}
            >
                ${ico(id)}

                <span class="lbl">${label}</span>

                ${count
                    ? `<span class="count">${count}</span>`
                    : ''
                }
            </button>
        `;
    }).join('');

    // Tenants on a phone get a bottom tab bar (shown by CSS under 900px).
    const TAB_LABEL = {
        lease: 'Lease',
        notices: 'Notices',
        pay: 'Pay',
        history: 'History',
        reports: 'Report',
        account: 'Account'
    };

    const tabbar = me.role === 'tenant'
        ? `
            <nav class="tabbar" aria-label="Tenant">
                ${nav.map(([id]) => {
                    const count = navCount(id);
                    const active = ui.page === id;

                    return `
                        <button
                            class="${active ? 'active' : ''}"
                            data-action="nav"
                            data-id="${id}"
                            ${active ? 'aria-current="page"' : ''}
                        >
                            ${ico(id)}
                            <span>${TAB_LABEL[id] || id}</span>
                            ${count ? `<span class="count">${count}</span>` : ''}
                        </button>
                    `;
                }).join('')}
            </nav>
        `
        : '';

    app.innerHTML = `
        <div class="shell${me.role === 'tenant' ? ' has-tabbar' : ''}">
            <aside class="side">
                <div class="brand">
                    ${LOGO}

                    <div>
                        <b>Oppa Yopa</b>
                        <small>${esc(db.settings.boardName || '')}</small>
                    </div>
                </div>

                <nav class="nav" aria-label="Main">
                    ${navigation}
                </nav>

                <div class="spacer"></div>

                <div class="who">
                    <span class="av">${esc(initials(me.name))}</span>

                    <div>
                        <b>${esc(me.name)}</b>
                        <small>
                            ${me.role === 'owner' ? 'Owner' : 'Tenant'}
                        </small>
                    </div>
                </div>

                <button
                    class="nav-btn logout"
                    data-action="logout"
                >
                    ${ico('logout')}
                    <span class="lbl">Log out</span>
                </button>
            </aside>

            <main id="main" tabindex="-1">
                ${content}
            </main>

            ${tabbar}
        </div>
    `;

    labelTables($('#app'));

    if (me.role === 'tenant' && ui.page === 'pay') {
        syncAmount(!ui.payMonth);
    }
}