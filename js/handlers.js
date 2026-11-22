
'use strict';

/* =====================================================================
   FORM HANDLERS
   ===================================================================== */

const forms = {
    login,

    addTenant(f) {
        const username = f.username.trim().toLowerCase();

        if (db.users.some(u => u.username === username)) {
            return toast('That username is already taken.', true);
        }

        const occupancy = db.tenants.filter(
            t => t.roomId === f.roomId
        ).length;

        if (
            occupancy >= roomOf(f.roomId).capacity &&
            !confirm('This room is already full. Add anyway?')
        ) {
            return;
        }

        const user = {
            id: uid(),
            username,
            pass: hash(f.password),
            role: 'tenant',
            name: f.name.trim()
        };

        db.users.push(user);

        db.tenants.push({
            id: uid(),
            userId: user.id,
            name: f.name.trim(),
            contact: f.contact.trim(),
            roomId: f.roomId,
            rent: +f.rent,
            deposit: +f.deposit || 0,
            start: f.start,
            months: +f.months,
            dueDay: +f.dueDay
        });

        save();
        render();

        credDialog(user.name, username, f.password);
        toast('Tenant added.');
    },

    editTenant(f) {
        const tenant = tenantOf(f.id);

        Object.assign(tenant, {
            name: f.name.trim(),
            contact: f.contact.trim(),
            roomId: f.roomId,
            rent: +f.rent,
            deposit: +f.deposit || 0,
            start: f.start,
            months: +f.months,
            dueDay: +f.dueDay
        });

        const user = db.users.find(
            u => u.id === tenant.userId
        );

        if (user) {
            user.name = tenant.name;
        }

        save();
        closeDlg();
        render();

        toast('Tenant updated.');
    },

    ownerPay(f) {
        submitPayment(f, true);
    },

    tenantPay(f) {
        submitPayment(f, false);
    },

    addRoom(f) {
        db.rooms.push({
            id: uid(),
            name: f.name.trim(),
            capacity: +f.capacity,
            rate: +f.rate
        });

        save();
        render();

        toast('Room added.');
    },

    announce(f, form) {
        db.announcements.push({
            id: uid(),
            title: f.title.trim(),
            message: f.message.trim(),
            priority: f.priority,
            roomId: f.audience === 'all' ? null : f.audience,
            date: new Date().toISOString()
        });

        save();
        render();

        toast('Announcement posted.');
    },

    complaint(f) {
        db.complaints.push({
            id: uid(),
            tenantId: myTenant().id,
            category: f.category,
            subject: f.subject.trim(),
            message: f.message.trim(),
            status: 'open',
            reply: '',
            date: new Date().toISOString()
        });

        save();
        render();

        toast('Report sent to your owner.');
    },

    respond(f) {
        const complaint = db.complaints.find(
            c => c.id === f.id
        );

        complaint.status = f.status;
        complaint.reply = f.reply.trim();
        complaint.updatedAt = new Date().toISOString();

        save();
        closeDlg();
        render();

        toast('Report updated.');
    },

    settings(f) {
        Object.assign(db.settings, f);

        save();
        render();

        toast('Settings saved.');
    },

    rejectPayment(f) {
        const payment = db.payments.find(
            p => p.id === f.id
        );

        if (!payment) {
            return toast('Payment not found.', true);
        }

        payment.status = 'rejected';
        payment.note = f.reason.trim() || 'Payment rejected';
        payment.resolvedAt = new Date().toISOString();

        save();
        closeDlg();
        render();

        toast('Payment rejected.');
    },

    changePw(f, form) {
        if (me.pass !== hash(f.old)) {
            return toast('Current password is wrong.', true);
        }

        me.pass = hash(f.pw);

        save();
        form.reset();

        toast('Password updated.');
    }
};


/* =====================================================================
   PAYMENT SUBMISSION
   ===================================================================== */

function submitPayment(f, isOwner) {
    const tenant = tenantOf(f.tenantId);
    const amount = +f.amount;

    if (!tenant || !monthsOf(tenant).includes(f.month)) {
        return toast('Choose a valid lease month to pay.', true);
    }

    const max = maxPayableFrom(tenant, f.month);

    if (!(amount > 0) || amount > max + 0.001) {
        return toast(
            `Amount must be between ₱1 and ${peso(max)}.`,
            true
        );
    }

    if (!isOwner && !channels().includes(f.method)) {
        return toast(
            'Your owner has not set up that payment method yet.',
            true
        );
    }

    if (f.method !== 'cash' && !f.ref.trim()) {
        return toast('Please enter the reference number.', true);
    }

    db.payments.push({
        id: uid(),
        tenantId: tenant.id,
        month: f.month,
        amount,
        method: f.method,
        ref: f.ref.trim(),
        note: f.note.trim(),
        status: isOwner ? 'confirmed' : 'pending',
        date: new Date().toISOString(),
        by: isOwner ? 'owner' : 'tenant'
    });

    save();
    closeDlg();

    ui.payMonth = '';

    if (!isOwner) {
        ui.page = 'history';
    }

    render();

    toast(
        isOwner
            ? 'Payment recorded.'
            : 'Submitted! Your owner will confirm it.'
    );
}


/* =====================================================================
   EVENT HANDLING (DELEGATED)
   ===================================================================== */

const actions = {
    nav: d => {
        ui.page = d.id;
        render();
    },

    goto: d => {
        closeDlg();
        ui.page = d.id;
        render();
    },

    delAnn: d => {
        if (
            !confirm(
                'Delete this announcement? Tenants will no longer see it.'
            )
        ) {
            return;
        }

        db.announcements = db.announcements.filter(
            a => a.id !== d.id
        );

        save();
        render();

        toast('Announcement deleted.');
    },

    logout,

    copy: d => {
        (
            navigator.clipboard
                ? navigator.clipboard.writeText(d.text)
                : Promise.reject()
        ).then(
            () => toast('Copied.'),
            () => toast(
                'Copy failed – select the text manually.',
                true
            )
        );
    },

    addTenant: () => {
        openDlg('Add tenant', tenantForm(null));
    },

    editTenant: d => {
        openDlg(
            'Edit tenant',
            tenantForm(tenantOf(d.id))
        );
    },

    viewTenant: d => {
        const tenant = tenantOf(d.id);

        openDlg(
            tenant.name + ' – ledger',
            ledgerHTML(tenant),
            true
        );
    },

    delTenant: d => {
        const tenant = tenantOf(d.id);

        if (
            !confirm(
                `Delete ${tenant.name}, their login, payments and reports? This cannot be undone.`
            )
        ) {
            return;
        }

        db.users = db.users.filter(
            u => u.id !== tenant.userId
        );

        db.payments = db.payments.filter(
            p => p.tenantId !== tenant.id
        );

        db.complaints = db.complaints.filter(
            c => c.tenantId !== tenant.id
        );

        db.tenants = db.tenants.filter(
            t => t.id !== tenant.id
        );

        save();
        closeDlg();
        render();

        toast('Tenant deleted.');
    },

    resetPw: d => {
        const tenant = tenantOf(d.id);

        const user = db.users.find(
            u => u.id === tenant.userId
        );

        if (!user) {
            return;
        }

        if (
            !confirm(
                `Reset the password for ${tenant.name}? Their current password will stop working right away.`
            )
        ) {
            return;
        }

        const password = randPass();

        user.pass = hash(password);

        save();

        credDialog(
            tenant.name,
            user.username,
            password
        );
    },

    delRoom: d => {
        if (db.tenants.some(t => t.roomId === d.id)) {
            return toast(
                'Move or remove the tenants in this room first.',
                true
            );
        }

        if (!confirm('Delete this room?')) {
            return;
        }

        db.rooms = db.rooms.filter(
            room => room.id !== d.id
        );

        save();
        render();
    },

    recordPay: d => {
        if (!db.tenants.length) {
            return toast('Add a tenant first.', true);
        }

        openDlg(
            'Record payment',
            payForm(
                d.id || db.tenants[0].id,
                true
            )
        );

        syncAmount();
    },

    confirmPay: d => {
        const payment = db.payments.find(
            p => p.id === d.id
        );

        if (!payment) {
            return toast('Payment not found.', true);
        }

        const tenant = tenantOf(payment.tenantId);

        if (!tenant) {
            return toast(
                'Tenant not found for this payment.',
                true
            );
        }

        const allocation = paymentAllocations(tenant)
            .byPayment.get(payment.id);

        if (
            !allocation ||
            allocation.unapplied > 0.001
        ) {
            return toast(
                'This payment exceeds the remaining rent through the lease end. Reject it or update the tenant’s lease first.',
                true
            );
        }

        payment.status = 'confirmed';
        payment.confirmedAt = payment.resolvedAt =
            new Date().toISOString();

        save();
        render();

        toast('Payment confirmed.');
    },

    rejectPay: d => {
        const payment = db.payments.find(
            p => p.id === d.id
        );

        if (!payment) {
            return toast('Payment not found.', true);
        }

        openDlg(
            'Reject payment',
            `
                <p>Tell the tenant why this payment was rejected.</p>

                <form data-form="rejectPayment">
                    <input
                        type="hidden"
                        name="id"
                        value="${esc(payment.id)}"
                    >

                    <div class="field">
                        <label for="rejectReason">Reason</label>

                        <textarea
                            id="rejectReason"
                            name="reason"
                            maxlength="160"
                            required
                        >Payment not received</textarea>
                    </div>

                    <div class="actions">
                        <button
                            type="button"
                            class="btn"
                            data-close
                        >
                            Cancel
                        </button>

                        <button class="btn danger">
                            Reject payment
                        </button>
                    </div>
                </form>
            `
        );
    },

    voidPay: d => {
        if (
            !confirm(
                'Void this confirmed payment? The balance will increase again.'
            )
        ) {
            return;
        }

        const payment = db.payments.find(
            p => p.id === d.id
        );

        payment.status = 'rejected';
        payment.note = 'Voided by owner';
        payment.resolvedAt = new Date().toISOString();

        save();
        render();

        toast('Payment voided.');
    },

    respond: d => {
        const complaint = db.complaints.find(
            c => c.id === d.id
        );

        openDlg(
            'Respond to report',
            `
                <p>
                    <b>${esc(complaint.subject)}</b>
                </p>

                <p class="muted">
                    ${esc(complaint.message)}
                </p>

                <form data-form="respond">
                    <input
                        type="hidden"
                        name="id"
                        value="${esc(complaint.id)}"
                    >

                    <div class="field">
                        <label>Status</label>

                        <select name="status">
                            ${['open', 'in_progress', 'resolved']
                                .map(status => `
                                    <option
                                        value="${status}"
                                        ${complaint.status === status ? 'selected' : ''}
                                    >
                                        ${STATUS_LABEL[status]}
                                    </option>
                                `)
                                .join('')}
                        </select>
                    </div>

                    <div class="field">
                        <label>Reply to tenant</label>

                        <textarea name="reply">${esc(complaint.reply)}</textarea>
                    </div>

                    <button class="btn primary block">
                        Save
                    </button>
                </form>
            `
        );
    },

    payNow: d => {
        ui.payMonth = d.ym || '';
        ui.page = 'pay';

        render();
    },

    backup: () => {
        const backup = new Blob(
            [JSON.stringify(db, null, 2)],
            { type: 'application/json' }
        );

        const link = document.createElement('a');

        link.href = URL.createObjectURL(backup);
        link.download = `oppa-yopa-backup-${todayStr()}.json`;

        link.click();

        URL.revokeObjectURL(link.href);
    },

    resetAll: () => {
        if (
            !confirm(
                'Erase ALL data and restore the demo data?'
            )
        ) {
            return;
        }

        localStorage.removeItem(KEY);
        localStorage.removeItem(SESSION);

        db = load();
        me = null;

        render();
    }
};


/* =====================================================================
   CLICK EVENTS
   ===================================================================== */

document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) {
        return closeDlg();
    }

    if (e.target.id === 'dlg') {
        return closeDlg();
    }

    const element = e.target.closest('[data-action]');

    if (!element) {
        return;
    }

    const action = actions[element.dataset.action];

    if (action) {
        action(element.dataset);
    }
});


/* =====================================================================
   FORM SUBMISSION
   ===================================================================== */

document.addEventListener('submit', e => {
    const name = e.target.dataset.form;

    if (!name) {
        return;
    }

    e.preventDefault();

    const formData = Object.fromEntries(
        new FormData(e.target)
    );

    if (forms[name]) {
        const submitButton = e.target.querySelector(
            'button[type="submit"], button:not([type])'
        );

        if (submitButton) {
            submitButton.disabled = true;

            setTimeout(() => {
                if (submitButton.isConnected) {
                    submitButton.disabled = false;
                }
            }, 500);
        }

        forms[name](formData, e.target);
    }
});


/* =====================================================================
   LIVE SEARCH AND FILTERS
   Re-render only the list so typing keeps focus.
   ===================================================================== */

document.addEventListener('input', e => {
    const key = e.target.dataset && e.target.dataset.live;

    if (key) {
        ui[key] = e.target.value;
        refreshRows();

        return;
    }

    if (e.target.id === 'tf-name') {
        const usernameInput = $('#tf-user');

        if (
            usernameInput &&
            !usernameInput.dataset.dirty
        ) {
            usernameInput.value = slug(e.target.value);
        }
    }

    if (e.target.id === 'tf-user') {
        e.target.dataset.dirty = '1';
    }
});


/* =====================================================================
   CHANGE EVENTS
   ===================================================================== */

document.addEventListener('change', e => {
    const key = e.target.dataset && e.target.dataset.live;

    if (key) {
        ui[key] = e.target.value;
        refreshRows();

        return;
    }

    if (e.target.id === 'tf-room') {
        const option = e.target.selectedOptions[0];

        if (option) {
            $('#tf-rent').value = option.dataset.rate;
        }
    }

    if (e.target.id === 'pf-t') {
        const tenant = tenantOf(e.target.value);

        $('#pf-m').innerHTML = monthOptions(tenant);

        syncAmount();
    }

    if (e.target.id === 'pf-m') {
        syncAmount();
    }
});


/* =====================================================================
   ROW REFRESHING
   ===================================================================== */

function refreshRows() {
    refreshRowsRaw();
    labelTables($('#rows'));
}

function refreshRowsRaw() {
    const box = $('#rows');

    if (!box) {
        return;
    }

    if (ui.page === 'tenants') {
        box.innerHTML = tenantRows();
    } else if (ui.page === 'payments') {
        box.innerHTML = paymentRows();
    } else if (ui.page === 'complaints') {
        const complaints = db.complaints
            .filter(c => ui.cf === 'all' || c.status === ui.cf)
            .sort((a, b) => b.date.localeCompare(a.date));

        box.innerHTML = complaintCards(complaints, true);
    }

}
