'use strict';

/* =====================================================================
   OWNER PAGES
   ===================================================================== */
function pgDashboard() {
  const ym = curYM();
  let expected = 0, collected = 0, outstanding = 0, overdue = 0;
  db.tenants.forEach(t => {
    if (monthsOf(t).includes(ym)) { const i = monthInfo(t, ym); expected += i.rent; collected += Math.min(i.paid, i.rent); }
    const s = tenantStatus(t); outstanding += s.balance; if (s.status === 'overdue') overdue++;
  });
  const pct = expected ? Math.min(100, Math.round(collected / expected * 100)) : 0;
  const pend = db.payments.filter(p => p.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  const open = db.complaints.filter(c => c.status === 'open').sort((a, b) => a.date.localeCompare(b.date));
  const payItems = pend.slice(0, 5).map(p => {
    const t = tenantOf(p.tenantId);
    return `<li class="row-item"><div><b>${esc(t ? t.name : 'A tenant')}</b> paid ${peso(p.amount)} for ${ymLabel(p.month)}<div class="muted small">${METHOD[p.method]}${p.ref ? ' · ref ' + esc(p.ref) : ''}</div></div><div class="actions"><button class="btn sm ok" data-action="confirmPay" data-id="${p.id}">Confirm received</button><button class="btn sm" data-action="rejectPay" data-id="${p.id}">Reject</button></div></li>`;
  }).join('') + (pend.length > 5 ? `<li class="row-item"><span class="muted">${pend.length - 5} more payments waiting</span><button class="btn sm" data-action="goto" data-id="payments">See all</button></li>` : '');
  const repItems = open.slice(0, 3).map(c => {
    const t = tenantOf(c.tenantId);
    return `<li class="row-item"><div><b>${esc(t ? t.name : 'A tenant')}</b> reported “${esc(c.subject)}”<div class="muted small">${esc(c.category)}</div></div><button class="btn sm" data-action="goto" data-id="complaints">Read</button></li>`;
  }).join('') + (open.length > 3 ? `<li class="row-item"><span class="muted">${open.length - 3} more reports</span><button class="btn sm" data-action="goto" data-id="complaints">See all</button></li>` : '');
  const waiting = payItems || repItems ? `<section class="panel"><h3>Waiting for you</h3><ul class="rows">${payItems}${repItems}</ul></section>` : '';
  const rows = db.tenants.map(t => {
    const s = tenantStatus(t), i = monthsOf(t).includes(ym) ? monthInfo(t, ym) : null;
    return `<tr><td><b>${esc(t.name)}</b><div class="muted small">${esc(roomName(t.roomId))}</div></td>
      <td>${stripHTML(t)}</td><td class="num">${i ? `${peso(i.paid)} of ${peso(i.rent)}` : '—'}</td>
      <td class="num">${s.balance > 0 ? peso(s.balance) : '—'}</td><td>${statusBadge(s)}</td>
      <td>${s.balance > 0 ? `<button class="btn sm" data-action="recordPay" data-id="${t.id}">Record payment</button>` : ''}</td></tr>`;
  }).join('');
  return `<div class="page-head"><div><h2>Dashboard</h2><p>${ymLabel(ym)}</p></div></div>
  <section class="summary"><div class="sum-main"><div class="k">Collected in ${new Date().toLocaleString('en-US', { month: 'long' })}</div><div class="big">${peso(collected)}</div>
    <div class="meter" role="img" aria-label="${pct}% collected"><i style="width:${pct}%"></i></div><div class="sub">${pct}% of ${peso(expected)} expected</div></div>
    <dl class="sum-facts"><div><dt>Outstanding</dt><dd>${peso(outstanding)}</dd></div><div><dt>Overdue</dt><dd class="${overdue ? 'neg' : ''}">${plural(overdue, 'tenant')}</dd></div><div><dt>Tenants</dt><dd>${db.tenants.length}</dd></div></dl></section>
  ${waiting}
  <section class="panel flush"><div class="panel-head"><h3>Who has paid</h3>${legendHTML()}</div>
  <div class="table-wrap">${rows ? `<table><thead><tr><th>Tenant</th><th>Rent by month</th><th class="num">This month</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : empty('No tenants yet. Go to Tenants to add one.')}</div></section>`;
}

/* --- Tenants --- */
function pgTenants() {
  return `<div class="page-head"><div><h2>Tenants</h2><p>Add tenants, assign rooms and create their login accounts.</p></div>
    <button class="btn primary" data-action="addTenant">+ Add tenant</button></div>
  <div class="card"><div class="toolbar">
    <input data-live="tq" value="${esc(ui.tq)}" placeholder="Search name or room…" aria-label="Search tenants">
    <select data-live="tf" aria-label="Filter status">${['all', 'paid', 'partial', 'overdue', 'unpaid'].map(v => `<option value="${v}" ${ui.tf === v ? 'selected' : ''}>${v === 'all' ? 'All statuses' : STATUS_LABEL[v]}</option>`).join('')}</select>
  </div><div class="table-wrap" id="rows">${tenantRows()}</div></div>`;
}
function tenantRows() {
  const q = ui.tq.toLowerCase();
  const list = db.tenants.filter(t => {
    const s = tenantStatus(t);
    const okQ = !q || t.name.toLowerCase().includes(q) || roomName(t.roomId).toLowerCase().includes(q);
    const okF = ui.tf === 'all' || (ui.tf === 'partial' ? s.partial : s.status === ui.tf);
    return okQ && okF;
  });
  if (!list.length) return empty('No tenants match.');
  return `<table><thead><tr><th>Tenant</th><th>Room</th><th class="num">Rent</th><th>Lease</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>${list.map(t => {
    const s = tenantStatus(t); const u = db.users.find(x => x.id === t.userId);
    return `<tr class="click" data-action="viewTenant" data-id="${t.id}"><td><b>${esc(t.name)}</b><div class="muted small">@${esc(u ? u.username : '?')} · ${esc(t.contact)}</div></td><td>${esc(roomName(t.roomId))}</td>
      <td class="num">${peso(t.rent)}</td><td>Until ${fmtDate(leaseEnd(t))}<div class="muted small">${leaseShort(t)}</div></td>
      <td class="num">${s.balance > 0 ? peso(s.balance) : '—'}</td><td>${statusBadge(s)}</td>
      <td><button class="btn sm" data-action="viewTenant" data-id="${t.id}">Open</button></td></tr>`;
  }).join('')}</tbody></table>`;
}
function tenantForm(t) {
  const edit = !!t;
  const roomOpts = db.rooms.map(r => `<option value="${r.id}" data-rate="${r.rate}" ${t && t.roomId === r.id ? 'selected' : ''}>${esc(r.name)} (${db.tenants.filter(x => x.roomId === r.id).length}/${r.capacity})</option>`).join('');
  if (!db.rooms.length) return '<p>Please add a room first (Rooms page).</p>';
  const first = db.rooms[0];
  return `<form data-form="${edit ? 'editTenant' : 'addTenant'}"><input type="hidden" name="id" value="${edit ? t.id : ''}">
    <div class="grid2"><div class="field"><label>Full name</label><input name="name" id="tf-name" required value="${edit ? esc(t.name) : ''}"></div>
    <div class="field"><label>Contact number</label><input name="contact" required value="${edit ? esc(t.contact) : ''}"></div></div>
    <div class="grid2"><div class="field"><label>Room</label><select name="roomId" id="tf-room">${roomOpts}</select></div>
    <div class="field"><label>Monthly rent (₱)</label><input name="rent" id="tf-rent" type="number" min="1" step="0.01" required value="${edit ? t.rent : first.rate}"></div></div>
    <div class="grid2"><div class="field"><label>Deposit (₱)</label><input name="deposit" type="number" min="0" step="0.01" value="${edit ? t.deposit : 0}"></div>
    <div class="field"><label>Rent due day (1–28)</label><input name="dueDay" type="number" min="1" max="28" required value="${edit ? t.dueDay : 5}"></div></div>
    <div class="grid2"><div class="field"><label>Lease start date</label><input name="start" type="date" required value="${edit ? t.start : todayStr().slice(0, 8) + '01'}"></div>
    <div class="field"><label>Lease length (months)</label><input name="months" type="number" min="1" max="60" required value="${edit ? t.months : 12}"></div></div>
    ${edit ? '' : `<div class="note">The tenant will use these to log in. You can give them the details after saving.</div>
    <div class="grid2"><div class="field"><label>Username</label><input name="username" id="tf-user" required autocomplete="off"></div>
    <div class="field"><label>Temporary password</label><input name="password" value="${randPass()}" required minlength="6" autocomplete="off"></div></div>`}
    <button class="btn primary block">${edit ? 'Save changes' : 'Create tenant & account'}</button></form>`;
}
function credDialog(name, username, password) {
  openDlg('Tenant account ready', `<p>Give these login details to <b>${esc(name)}</b>. They can change the password after logging in.</p>
    <div class="cred">Username: <b>${esc(username)}</b><br>Password: <b>${esc(password)}</b></div>
    <button class="btn block" data-action="copy" data-text="${esc('Oppa Yopa login\nUsername: ' + username + '\nPassword: ' + password)}">Copy to clipboard</button>`);
}
function ledgerHTML(t) {
  const pays = db.payments.filter(p => p.tenantId === t.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="actions" style="margin-bottom:18px"><button class="btn primary sm" data-action="recordPay" data-id="${t.id}">Record payment</button><button class="btn sm" data-action="editTenant" data-id="${t.id}">Edit details</button><button class="btn sm" data-action="resetPw" data-id="${t.id}">Reset password</button><button class="btn sm danger" data-action="delTenant" data-id="${t.id}">Delete tenant</button></div>
  <dl class="kv"><dt>Room</dt><dd>${esc(roomName(t.roomId))}</dd><dt>Rent</dt><dd>${peso(t.rent)} / month, due every ${t.dueDay}th</dd><dt>Lease</dt><dd>${fmtDate(t.start)} – ${fmtDate(leaseEnd(t))}</dd><dt>Duration</dt><dd>${leaseDetail(t)}</dd><dt>Deposit</dt><dd>${peso(t.deposit)}</dd><dt>Contact</dt><dd>${esc(t.contact)}</dd></dl>
  <h3 class="sub">Lease calendar</h3>${calendarHTML(t, false)}${legendHTML()}
  <h3 class="sub">Payment history</h3><div class="table-wrap">${paymentTable(pays, false, false)}</div>`;
}

/* --- Rooms --- */
function pgRooms() {
  return `<div class="page-head"><div><h2>Rooms</h2><p>Set up rooms, capacity and standard rates.</p></div></div>
  <div class="two"><div class="card"><h3>Add a room</h3><form data-form="addRoom">
    <div class="field"><label>Room name</label><input name="name" required placeholder="e.g. Room 3"></div>
    <div class="grid2"><div class="field"><label>Capacity (beds)</label><input name="capacity" type="number" min="1" required value="2"></div>
    <div class="field"><label>Rate / person (₱)</label><input name="rate" type="number" min="0" step="0.01" required></div></div>
    <button class="btn primary">Add room</button></form></div>
  <div class="card"><h3>Your rooms</h3>${db.rooms.length ? `<div class="table-wrap"><table><thead><tr><th>Room</th><th>Occupancy</th><th class="num">Rate</th><th></th></tr></thead><tbody>${db.rooms.map(r => {
    const occ = db.tenants.filter(t => t.roomId === r.id);
    return `<tr><td><b>${esc(r.name)}</b></td><td><span class="beds" role="img" aria-label="${occ.length} of ${r.capacity} beds taken">${Array.from({ length: r.capacity }, (_, k) => `<i class="${k < occ.length ? 'on' : ''}"></i>`).join('')}</span> <span class="small">${occ.length}/${r.capacity}</span><div class="muted small">${occ.map(t => esc(t.name)).join(', ') || 'Vacant'}</div></td><td class="num">${peso(r.rate)}</td><td><button class="btn sm danger" data-action="delRoom" data-id="${r.id}">Delete</button></td></tr>`;
  }).join('')}</tbody></table></div>` : empty('No rooms yet.')}</div></div>`;
}

/* --- Payments (owner) --- */
function paymentTable(list, owner, showTenant = true, showStatus = true) {
  if (!list.length) return empty('No payments found.');
  return `<table><thead><tr><th>Date</th>${showTenant ? '<th>Tenant</th>' : ''}<th>For month</th><th class="num">Amount</th><th>Method</th><th>Reference</th>${showStatus ? '<th>Status</th>' : ''}${owner ? '<th></th>' : ''}</tr></thead><tbody>${list.map(p => {
    const t = tenantOf(p.tenantId);
    let act = '';
    if (owner) {
      if (p.status === 'pending') act = `<button class="btn sm ok" data-action="confirmPay" data-id="${p.id}">Confirm received</button><button class="btn sm danger" data-action="rejectPay" data-id="${p.id}">Reject</button>`;
      else if (p.status === 'confirmed') act = `<button class="btn sm danger" data-action="voidPay" data-id="${p.id}">Void</button>`;
    }
    return `<tr><td class="small nw">${fmtShort(p.date)}</td>${showTenant ? `<td class="nw">${esc(t ? t.name : 'Deleted')}</td>` : ''}<td class="nw">${ymLabel(p.month)}</td><td class="num">${peso(p.amount)}</td>
      <td class="nw">${METHOD[p.method]}${p.method === 'cash' ? '<div class="muted small">by owner</div>' : ''}</td><td class="small"><span class="nw">${esc(p.ref) || '—'}</span>${p.note ? `<div class="muted">${esc(p.note)}</div>` : ''}</td>${showStatus ? `<td>${badge(p.status)}</td>` : ''}${owner ? `<td><div class="actions">${act}</div></td>` : ''}</tr>`;
  }).join('')}</tbody></table>`;
}
function pgPayments() {
  const pend = db.payments.filter(p => p.status === 'pending').sort((a, b) => a.date.localeCompare(b.date));
  return `<div class="page-head"><div><h2>Payments</h2><p>Confirm GCash/bank payments, and record cash payments.</p></div><button class="btn primary" data-action="recordPay" data-id="">+ Record payment</button></div>
  <div class="card"><h3>Awaiting confirmation (${pend.length})</h3><p class="muted small" style="margin-top:-6px">Check your GCash or bank app for the reference number before confirming.</p><div class="table-wrap">${pend.length ? paymentTable(pend, true, true, false) : empty('Nothing to confirm right now.')}</div></div>
  <div class="card"><h3>Payment history</h3><div class="toolbar">
    <input data-live="pq" value="${esc(ui.pq)}" placeholder="Search tenant or reference…" aria-label="Search payments">
    <select data-live="pf" aria-label="Filter payments">${['all', 'confirmed', 'pending', 'rejected', 'cash', 'gcash', 'bank'].map(v => `<option value="${v}" ${ui.pf === v ? 'selected' : ''}>${v === 'all' ? 'All' : (STATUS_LABEL[v] || METHOD[v])}</option>`).join('')}</select>
  </div><div class="table-wrap" id="rows">${paymentRows()}</div></div>`;
}
function paymentRows() {
  const q = ui.pq.toLowerCase();
  const list = db.payments.filter(p => {
    const t = tenantOf(p.tenantId);
    const okQ = !q || (t && t.name.toLowerCase().includes(q)) || (p.ref || '').toLowerCase().includes(q);
    const okF = ui.pf === 'all' || p.status === ui.pf || p.method === ui.pf;
    return okQ && okF;
  }).sort((a, b) => b.date.localeCompare(a.date));
  return paymentTable(list, true);
}
function payForm(tenantId, isOwner) {
  const tenants = isOwner ? db.tenants : [myTenant()];
  if (!tenants.length || !tenants[0]) return '<p>No tenants available.</p>';
  const t = tenantOf(tenantId) || tenants[0];
  const sel = isOwner ? '' : ui.payMonth;
  const tenantField = isOwner
    ? `<div class="field"><label>Tenant</label><select id="pf-t" name="tenantId">${db.tenants.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)} – ${esc(roomName(x.roomId))}</option>`).join('')}</select></div>`
    : `<input type="hidden" id="pf-t" name="tenantId" value="${t.id}">`;
  const methods = isOwner ? ['cash', 'gcash', 'bank'] : channels();
  if (!methods.length) return '<p class="muted">Online payment is not available yet.</p>';
  return `<form data-form="${isOwner ? 'ownerPay' : 'tenantPay'}">${tenantField}
    <div class="field"><label>Pay for month</label><select id="pf-m" name="month" required>${monthOptions(t, sel)}</select></div>
    <div class="field"><label>Payment method</label><div class="method-pick">${methods.map((m, i) => `<label><input type="radio" name="method" value="${m}" ${i === 0 ? 'checked' : ''}>${METHOD[m]}</label>`).join('')}</div></div>
    <div class="grid2"><div class="field"><label>Amount (₱)</label><input id="pf-a" name="amount" type="number" min="1" step="0.01" required></div>
    <div class="field"><label>Reference no. ${isOwner ? '(optional for cash)' : ''}</label><input name="ref" placeholder="e.g. GCash ref #"></div></div>
    <div class="field"><label>Note (optional)</label><input name="note" maxlength="120"></div>
    <button class="btn primary block">${isOwner ? 'Save payment' : 'Submit payment for confirmation'}</button></form>`;
}
function syncAmount() {
  const tid = $('#pf-t'), m = $('#pf-m'), a = $('#pf-a'); if (!tid || !m || !a) return;
  const t = tenantOf(tid.value); if (!t || !m.value) { a.value = ''; return; }
  const av = availFor(t, m.value); a.value = av > 0 ? av : ''; a.max = av;
}

/* --- Complaints (owner) --- */
function pgComplaints() {
  const list = db.complaints.filter(c => ui.cf === 'all' || c.status === ui.cf).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page-head"><div><h2>Tenant reports</h2><p>Complaints and concerns sent by your tenants.</p></div></div>
  <div class="card"><div class="toolbar"><select data-live="cf" aria-label="Filter reports">${['all', 'open', 'in_progress', 'resolved'].map(v => `<option value="${v}" ${ui.cf === v ? 'selected' : ''}>${v === 'all' ? 'All reports' : STATUS_LABEL[v]}</option>`).join('')}</select></div>
  <div id="rows">${complaintCards(list, true)}</div></div>`;
}
function complaintCards(list, owner) {
  if (!list.length) return empty('No reports.');
  return list.map(c => {
    const t = tenantOf(c.tenantId);
    return `<div class="cmp"><div class="cmp-head"><div><b>${esc(c.subject)}</b> <span class="muted small">· ${esc(c.category)}</span></div>${badge(c.status)}</div>
      <div class="muted small">${owner ? esc(t ? t.name : 'Deleted tenant') + ' · ' + esc(t ? roomName(t.roomId) : '') + ' · ' : ''}${fmtDate(c.date)}</div>
      <p style="margin:8px 0">${esc(c.message).replace(/\n/g, '<br>')}</p>
      ${c.reply ? `<div class="reply"><b>Owner reply:</b> ${esc(c.reply)}</div>` : ''}
      ${owner ? `<div style="margin-top:10px"><button class="btn sm" data-action="respond" data-id="${c.id}">Update / reply</button></div>` : ''}</div>`;
  }).join('');
}

/* --- Settings --- */
function pgSettings() {
  const s = db.settings;
  return `<div class="page-head"><div><h2>Settings</h2><p>Payment details shown to tenants when they pay.</p></div></div>
  <div class="two"><div class="card"><h3>House & payment details</h3><form data-form="settings">
    <div class="field"><label>Boarding house name</label><input name="boardName" value="${esc(s.boardName)}" required></div>
    <div class="grid2"><div class="field"><label>GCash account name</label><input name="gcashName" value="${esc(s.gcashName)}"></div>
    <div class="field"><label>GCash number</label><input name="gcashNumber" value="${esc(s.gcashNumber)}"></div></div>
    <div class="grid2"><div class="field"><label>Bank name</label><input name="bankName" value="${esc(s.bankName)}"></div>
    <div class="field"><label>Account number</label><input name="bankAcct" value="${esc(s.bankAcct)}"></div></div>
    <div class="field"><label>Account holder</label><input name="bankHolder" value="${esc(s.bankHolder)}"></div>
    <div class="field"><label>Extra instructions</label><textarea name="instructions" style="min-height:70px">${esc(s.instructions)}</textarea></div>
    <button class="btn primary">Save settings</button></form></div>
  <div>${pwCard()}<div class="card"><h3>Data</h3><p class="muted small">Everything is stored in this browser only.</p><div class="actions"><button class="btn" data-action="backup">Download backup (JSON)</button><button class="btn danger" data-action="resetAll">Reset all data</button></div></div></div></div>`;
}
function pwCard() {
  return `<div class="card"><h3>Change password</h3><form data-form="changePw">
    <div class="field"><label>Current password</label><input type="password" name="old" required></div>
    <div class="field"><label>New password (min 6 characters)</label><input type="password" name="pw" minlength="6" required></div>
    <button class="btn primary">Update password</button></form></div>`;
}

/* =====================================================================
   TENANT PAGES
   ===================================================================== */
function noLease() { return `<div class="card">${empty('Your tenant record was not found. Please contact your owner.')}</div>`; }
function pgLease() {
  const t = myTenant(); if (!t) return noLease();
  const s = tenantStatus(t); const infos = monthsOf(t).map(m => monthInfo(t, m));
  const next = infos.find(i => i.balance > 0);
  return `<div class="page-head"><div><h2>My lease</h2><p>${esc(t.name)} · ${esc(roomName(t.roomId))}</p></div><button class="btn primary" data-action="payNow" data-ym="">Pay rent</button></div>
  ${s.status === 'overdue' ? `<div class="alert red">You have an overdue balance of ${peso(s.balance)}. Please pay as soon as possible.</div>` : s.balance > 0 ? `<div class="alert amber">Outstanding balance: ${peso(s.balance)}.</div>` : ''}
  <section class="summary"><div class="sum-main"><div class="k">Balance now</div><div class="big ${s.status === 'overdue' ? 'neg' : ''}">${peso(s.balance)}</div><div class="sub">${next ? 'Next due ' + fmtDate(next.due) : 'You are all paid up'}</div></div>
    <dl class="sum-facts"><div><dt>Monthly rent</dt><dd>${peso(t.rent)}</dd></div><div><dt>Lease</dt><dd>${leaseShort(t)}</dd></div><div><dt>Deposit</dt><dd>${peso(t.deposit)}</dd></div></dl></section>
  <section class="panel"><h3>Lease calendar</h3>${calendarHTML(t, true)}${legendHTML()}<p class="muted small" style="margin:12px 0 0">Select a month to pay it.</p></section>
  <section class="panel"><h3>Lease details</h3><dl class="facts"><div><dt>Room</dt><dd>${esc(roomName(t.roomId))}</dd></div><div><dt>Lease period</dt><dd>${fmtDate(t.start)} – ${fmtDate(leaseEnd(t))}</dd></div><div><dt>Rent due</dt><dd>Every ${t.dueDay}th of the month</dd></div><div><dt>Contact on file</dt><dd>${esc(t.contact)}</dd></div><div class="wide"><dt>Duration</dt><dd>${leaseDetail(t)}</dd></div></dl></section>
  <section class="panel flush"><details class="sched" ${window.innerWidth > 900 ? 'open' : ''}><summary><h3>Monthly rent schedule</h3></summary><div class="table-wrap"><table><thead><tr><th>Month</th><th>Due date</th><th class="num">Rent</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody>
  ${infos.map(i => `<tr><td>${ymLabel(i.ym)}</td><td>${fmtDate(i.due)}</td><td class="num">${peso(i.rent)}</td><td class="num">${peso(i.paid)}${i.methods.length ? `<div class="muted small">via ${i.methods.map(m => METHOD[m].toLowerCase()).join(', ')}</div>` : ''}</td><td class="num">${peso(i.balance)}</td>
  <td>${infoBadge(i)}${i.pending > 0 ? `<div class="muted small">${peso(i.pending)} awaiting confirmation</div>` : ''}</td>
  <td>${availFor(t, i.ym) > 0 ? `<button class="btn sm" data-action="payNow" data-ym="${i.ym}">Pay</button>` : ''}</td></tr>`).join('')}</tbody></table></div></details></section>`;
}
function pgPay() {
  const t = myTenant(); if (!t) return noLease(); const s = db.settings;
  const ch = channels(), hasDetails = ch.length > 0;
  const method = (title, who, num) => `<div class="method-card"><div><div class="muted small">${esc(title)}</div><div class="num-big">${esc(num)}</div><div class="small">${esc(who)}</div></div><button class="btn sm" data-action="copy" data-text="${esc(num)}">Copy number</button></div>`;
  return `<div class="page-head"><div><h2>Pay rent</h2><p>Send your payment by GCash or bank, then submit the reference number.</p></div></div>
  <div class="two"><section class="panel"><h3>Send your payment</h3>
    ${ch.includes('gcash') ? method('GCash', s.gcashName, s.gcashNumber) : ''}
    ${ch.includes('bank') ? method(s.bankName || 'Bank', s.bankHolder, s.bankAcct) : ''}
    ${hasDetails ? '' : '<div class="alert amber">Online payment is not available yet. Your owner has not set up a GCash number or bank account. You can pay in cash, or ask your owner to add their payment details.</div>'}
    ${s.instructions ? `<div class="note">${esc(s.instructions)}</div>` : ''}
    <div class="note"><b>Paying in cash?</b> Hand it to your owner. They will record it and it will appear in your payments as paid via cash.</div></section>
  <section class="panel"><h3>Submit for confirmation</h3>${hasDetails ? payForm(t.id, false) : '<p class="muted">You can submit a GCash or bank payment here once your owner adds their payment details.</p>'}</section></div>`;
}
function pgHistory() {
  const t = myTenant(); if (!t) return noLease();
  const list = db.payments.filter(p => p.tenantId === t.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page-head"><div><h2>My Payments</h2><p>Your complete payment record.</p></div></div><div class="card"><div class="table-wrap">${paymentTable(list, false, false)}</div></div>`;
}
function pgReports() {
  const t = myTenant(); if (!t) return noLease();
  const list = db.complaints.filter(c => c.tenantId === t.id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="page-head"><div><h2>Send a Report</h2><p>Tell your owner about a problem or concern.</p></div></div>
  <div class="two"><div class="card"><h3>New report</h3><form data-form="complaint">
    <div class="field"><label>Category</label><select name="category">${['Maintenance', 'Utilities', 'Noise', 'Safety', 'Billing', 'Other'].map(c => `<option>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Subject</label><input name="subject" maxlength="80" required></div>
    <div class="field"><label>Message</label><textarea name="message" required></textarea></div>
    <button class="btn primary">Send to owner</button></form></div>
  <div class="card"><h3>My reports</h3>${complaintCards(list, false)}</div></div>`;
}
function pgAccount() {
  return `<div class="page-head"><div><h2>Account</h2><p>Signed in as <b>@${esc(me.username)}</b></p></div></div><div style="max-width:440px">${pwCard()}</div>`;
}
