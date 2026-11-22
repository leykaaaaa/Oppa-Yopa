
'use strict';

// Get announcements visible to a specific tenant.
const annFor = tenant =>
    db.announcements
        .filter(announcement =>
            !announcement.roomId ||
            announcement.roomId === tenant.roomId
        )
        .sort((a, b) => b.date.localeCompare(a.date));

// Get tenants who should receive an announcement.
const annTargets = announcement =>
    db.tenants.filter(tenant =>
        !announcement.roomId ||
        tenant.roomId === announcement.roomId
    );

// Get the announcement audience label.
const annAudience = announcement =>
    announcement.roomId
        ? `${roomName(announcement.roomId)} only`
        : 'All tenants';

// Get unread announcements for the current tenant.
function unreadAnn() {
    const tenant = me && myTenant();

    if (!tenant) return [];

    const seen = me.seenAnn || [];

    return annFor(tenant).filter(
        announcement => !seen.includes(announcement.id)
    );
}

// Escape announcement text and preserve line breaks.
const annBody = message =>
    esc(message).replace(/\n/g, '<br>');



// Owner Announcement

function pgAnnounce() {
    const announcements = [...db.announcements].sort(
        (a, b) => b.date.localeCompare(a.date)
    );

    const roomOptions = db.rooms
        .map(room => `
            <option value="${room.id}">
                ${esc(room.name)} only
            </option>
        `)
        .join('');

    const announcementList = announcements.length
        ? announcements.map(announcement => {
            const targets = annTargets(announcement);

            const seenCount = targets.filter(tenant => {
                const user = db.users.find(
                    user => user.id === tenant.userId
                );

                return user &&
                    (user.seenAnn || []).includes(announcement.id);
            }).length;

            return `
                <div class="cmp">
                    <div class="cmp-head">
                        <b>${esc(announcement.title)}</b>

                        ${
                            announcement.priority === 'important'
                                ? badge('important')
                                : ''
                        }
                    </div>

                    <div class="muted small">
                        To: ${esc(annAudience(announcement))} ·
                        ${fmtDate(announcement.date)} ·
                        Seen by ${seenCount} of ${targets.length}
                    </div>

                    <p style="margin: 8px 0">
                        ${annBody(announcement.message)}
                    </p>

                    <button
                        class="btn sm danger"
                        data-action="delAnn"
                        data-id="${announcement.id}"
                    >
                        Delete
                    </button>
                </div>
            `;
        }).join('')
        : empty('Nothing posted yet.');

    return `
        <div class="page-head">
            <div>
                <h2>Announcements</h2>
                <p>
                    Post a notice your tenants will see when they sign in.
                </p>
            </div>
        </div>

        <div class="two">

            <!-- New announcement form -->
            <div class="card">
                <h3>New announcement</h3>

                <form data-form="announce">

                    <div class="grid2">
                        <div class="field">
                            <label for="an-to">Send to</label>

                            <select id="an-to" name="audience">
                                <option value="all">All tenants</option>
                                ${roomOptions}
                            </select>
                        </div>

                        <div class="field">
                            <label for="an-pr">Priority</label>

                            <select id="an-pr" name="priority">
                                <option value="normal">Normal</option>
                                <option value="important">Important</option>
                            </select>
                        </div>
                    </div>

                    <div class="field">
                        <label for="an-t">Title</label>

                        <input
                            id="an-t"
                            name="title"
                            maxlength="80"
                            required
                            placeholder="e.g. Water interruption on Friday"
                        >
                    </div>

                    <div class="field">
                        <label for="an-m">Message</label>

                        <textarea
                            id="an-m"
                            name="message"
                            required
                        ></textarea>
                    </div>

                    <button class="btn primary">
                        Post announcement
                    </button>

                </form>
            </div>

            <!-- Posted announcements -->
            <div class="card">
                <h3>Posted (${announcements.length})</h3>

                ${announcementList}
            </div>

        </div>
    `;
}


// Tenants view annnouncements

function pgNotices() {
    const tenant = myTenant();

    if (!tenant) return noLease();

    // Capture unread announcements before marking them as read.
    const fresh = unreadAnn().map(announcement => announcement.id);

    const announcements = annFor(tenant);

    // Opening this page marks announcements as read.
    // New tags remain visible during this visit.
    if (fresh.length) {
        me.seenAnn = [
            ...new Set([
                ...(me.seenAnn || []),
                ...fresh
            ])
        ];

        save();
    }

    const announcementList = announcements.length
        ? announcements.map(announcement => `
            <div class="cmp">
                <div class="cmp-head">
                    <b>${esc(announcement.title)}</b>

                    <span>
                        ${
                            fresh.includes(announcement.id)
                                ? badge('new') + ' '
                                : ''
                        }

                        ${
                            announcement.priority === 'important'
                                ? badge('important')
                                : ''
                        }
                    </span>
                </div>

                <div class="muted small">
                    ${fmtDate(announcement.date)}
                </div>

                <p style="margin: 8px 0 0">
                    ${annBody(announcement.message)}
                </p>
            </div>
        `).join('')
        : empty('No announcements yet.');

    return `
        <div class="page-head">
            <div>
                <h2>Announcements</h2>
                <p>Notices from your owner.</p>
            </div>
        </div>

        <div class="card">
            ${announcementList}
        </div>
    `;
}


// WELCOME DIALOG

// Limit the number of items displayed in a welcome section.
function listItems(items, renderItem, max = 5) {
    const output = items
        .slice(0, max)
        .map(renderItem);

    if (items.length > max) {
        output.push(`
            <li class="muted">
                and ${items.length - max} more
            </li>
        `);
    }

    return output;
}

// Show a "New" tag for items created or updated since last visit.
function showWelcome(prev) {
    const isNew = date =>
        !prev || (date && date > prev);

    const tag = date =>
        isNew(date)
            ? ' <span class="badge new">New</span>'
            : '';

    // Render a welcome dialog section.
    const section = (title, items, page, buttonLabel) =>
        items.length
            ? `
                <div class="wl-sec">
                    <h4>${title}</h4>

                    <ul class="wl-list">
                        ${items.join('')}
                    </ul>

                    <button
                        class="btn sm"
                        data-action="goto"
                        data-id="${page}"
                    >
                        ${buttonLabel}
                    </button>
                </div>
            `
            : '';

    let title;
    let body = '';

    // OWNER DASHBOARD//

    if (me.role === 'owner') {
        title = 'While you were away';

        const pendingPayments = db.payments
            .filter(payment => payment.status === 'pending')
            .sort((a, b) => b.date.localeCompare(a.date));

        const openComplaints = db.complaints
            .filter(complaint => complaint.status === 'open')
            .sort((a, b) => b.date.localeCompare(a.date));

        const overdueTenants = db.tenants.filter(
            tenant => tenantStatus(tenant).status === 'overdue'
        );

        // Pending payments.
        body += section(
            `${plural(
                pendingPayments.length,
                'payment'
            )} waiting for your confirmation`,

            listItems(pendingPayments, payment => {
                const tenant = tenantOf(payment.tenantId);

                return `
                    <li>
                        <b>${esc(tenant ? tenant.name : 'A tenant')}</b>

                        paid ${peso(payment.amount)}
                        for ${ymLabel(payment.month)}
                        via ${METHOD[payment.method]}

                        ${
                            payment.ref
                                ? ` (ref ${esc(payment.ref)})`
                                : ''
                        }.

                        ${tag(payment.date)}
                    </li>
                `;
            }),

            'payments',
            'Review payments'
        );

        // Open complaints.
        body += section(
            `${plural(
                openComplaints.length,
                'new report'
            )} from tenants`,

            listItems(openComplaints, complaint => {
                const tenant = tenantOf(complaint.tenantId);

                return `
                    <li>
                        <b>${esc(tenant ? tenant.name : 'A tenant')}</b>:
                        ${esc(complaint.subject)}.
                        ${tag(complaint.date)}
                    </li>
                `;
            }),

            'complaints',
            'Read reports'
        );

        // Overdue tenants.
        body += section(
            `${plural(
                overdueTenants.length,
                'tenant'
            )} with overdue rent`,

            listItems(overdueTenants, tenant => `
                <li>
                    <b>${esc(tenant.name)}</b>
                    owes ${peso(tenantStatus(tenant).balance)}.
                </li>
            `),

            'tenants',
            'View tenants'
        );

    } else {

       // TENANT DASHBOARD //

        const tenant = myTenant();

        if (!tenant) return;

        title = `Welcome back, ${me.name.split(' ')[0]}`;

        const announcements = unreadAnn();

        const paymentUpdates = db.payments.filter(
            payment =>
                payment.tenantId === tenant.id &&
                payment.resolvedAt &&
                isNew(payment.resolvedAt)
        );

        const reportUpdates = db.complaints.filter(
            complaint =>
                complaint.tenantId === tenant.id &&
                complaint.updatedAt &&
                isNew(complaint.updatedAt)
        );

        // New announcements.
        body += section(
            `${plural(
                announcements.length,
                'new announcement'
            )}`,

            listItems(announcements, announcement => `
                <li>
                    <b>${esc(announcement.title)}</b>

                    ${
                        announcement.priority === 'important'
                            ? ' ' + badge('important')
                            : ''
                    }

                    <div class="muted small">
                        ${fmtDate(announcement.date)}
                    </div>
                </li>
            `),

            'notices',
            'Read announcements'
        );

        // Payment updates.
        body += section(
            'Payment updates',

            listItems(paymentUpdates, payment => {
                const status =
                    payment.status === 'confirmed'
                        ? 'confirmed'
                        : 'rejected';

                const note =
                    payment.status === 'rejected' && payment.note
                        ? `: ${esc(payment.note)}`
                        : '';

                return `
                    <li>
                        Your ${peso(payment.amount)} payment
                        for ${ymLabel(payment.month)}
                        was ${status}${note}.
                    </li>
                `;
            }),

            'history',
            'View payments'
        );

        // Report updates.
        body += section(
            'Report updates',

            listItems(reportUpdates, complaint => `
                <li>
                    Your owner updated
                    “${esc(complaint.subject)}”
                    to <b>${STATUS_LABEL[complaint.status]}</b>.
                </li>
            `),

            'reports',
            'View reports'
        );
    }

    // Do not show an empty welcome dialog.
    if (!body) return;

    openDlg(
        title,
        body + `
            <div class="actions">
                <button class="btn primary" data-close>
                    Got it
                </button>
            </div>
        `
    );
}
