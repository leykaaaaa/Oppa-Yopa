'use strict';

const forms = {
  login,
  addTenant(f) {
    const username = f.username.trim().toLowerCase();
    if (db.users.some(u => u.username === username)) return toast('That username is already taken.', true);
    const occ = db.tenants.filter(t => t.roomId === f.roomId).length;
    if (occ >= roomOf(f.roomId).capacity && !confirm('This room is already full. Add anyway?')) return;
    const u = { id: uid(), username, pass: hash(f.password), role: 'tenant', name: f.name.trim() };
    db.users.push(u);
    db.tenants.push({ id: uid(), userId: u.id, name: f.name.trim(), contact: f.contact.trim(), roomId: f.roomId, rent: +f.rent, deposit: +f.deposit || 0, start: f.start, months: +f.months, dueDay: +f.dueDay });
    save(); render(); credDialog(u.name, username, f.password); toast('Tenant added.');
  },
  editTenant(f) {
    const t = tenantOf(f.id); Object.assign(t, { name: f.name.trim(), contact: f.contact.trim(), roomId: f.roomId, rent: +f.rent, deposit: +f.deposit || 0, start: f.start, months: +f.months, dueDay: +f.dueDay });
    const u = db.users.find(x => x.id === t.userId); if (u) u.name = t.name;
    save(); closeDlg(); render(); toast('Tenant updated.');
  },
  ownerPay(f) { submitPayment(f, true); },
  tenantPay(f) { submitPayment(f, false); },
  addRoom(f) { db.rooms.push({ id: uid(), name: f.name.trim(), capacity: +f.capacity, rate: +f.rate }); save(); render(); toast('Room added.'); },
  announce(f, form) {
    db.announcements.push({ id: uid(), title: f.title.trim(), message: f.message.trim(), priority: f.priority, roomId: f.audience === 'all' ? null : f.audience, date: new Date().toISOString() });
    save(); render(); toast('Announcement posted.');
  },
  complaint(f) {
    db.complaints.push({ id: uid(), tenantId: myTenant().id, category: f.category, subject: f.subject.trim(), message: f.message.trim(), status: 'open', reply: '', date: new Date().toISOString() });
    save(); render(); toast('Report sent to your owner.');
  },
  respond(f) { const c = db.complaints.find(x => x.id === f.id); c.status = f.status; c.reply = f.reply.trim(); c.updatedAt = new Date().toISOString(); save(); closeDlg(); render(); toast('Report updated.'); },
  settings(f) { Object.assign(db.settings, f); save(); render(); toast('Settings saved.'); },
  changePw(f, form) {
    if (me.pass !== hash(f.old)) return toast('Current password is wrong.', true);
    me.pass = hash(f.pw); save(); form.reset(); toast('Password updated.');
  }
};
function submitPayment(f, isOwner) {
  const t = tenantOf(f.tenantId); const amount = +f.amount;
  if (!t || !f.month) return toast('Choose a month to pay.', true);
  const av = availFor(t, f.month);
  if (!(amount > 0) || amount > av + 0.001) return toast(`Amount must be between ₱1 and ${peso(av)}.`, true);
  if (!isOwner && !channels().includes(f.method)) return toast('Your owner has not set up that payment method yet.', true);
  if (f.method !== 'cash' && !f.ref.trim()) return toast('Please enter the reference number.', true);
  db.payments.push({ id: uid(), tenantId: t.id, month: f.month, amount, method: f.method, ref: f.ref.trim(), note: f.note.trim(), status: isOwner ? 'confirmed' : 'pending', date: new Date().toISOString(), by: isOwner ? 'owner' : 'tenant' });
  save(); closeDlg(); ui.payMonth = '';
  if (!isOwner) ui.page = 'history';
  render(); toast(isOwner ? 'Payment recorded.' : 'Submitted! Your owner will confirm it.');
}

/* =====================================================================
   EVENT HANDLING (delegated)
   ===================================================================== */
const actions = {
  nav: d => { ui.page = d.id; render(); },
  goto: d => { closeDlg(); ui.page = d.id; render(); },
  delAnn: d => {
    if (!confirm('Delete this announcement? Tenants will no longer see it.')) return;
    db.announcements = db.announcements.filter(a => a.id !== d.id); save(); render(); toast('Announcement deleted.');
  },
  logout,
  copy: d => { (navigator.clipboard ? navigator.clipboard.writeText(d.text) : Promise.reject()).then(() => toast('Copied.'), () => toast('Copy failed – select the text manually.', true)); },
  addTenant: () => openDlg('Add tenant', tenantForm(null)),
  editTenant: d => openDlg('Edit tenant', tenantForm(tenantOf(d.id))),
  viewTenant: d => { const t = tenantOf(d.id); openDlg(t.name + ' – ledger', ledgerHTML(t), true); },
  delTenant: d => {
    const t = tenantOf(d.id);
    if (!confirm(`Delete ${t.name}, their login, payments and reports? This cannot be undone.`)) return;
    db.users = db.users.filter(u => u.id !== t.userId); db.payments = db.payments.filter(p => p.tenantId !== t.id);
    db.complaints = db.complaints.filter(c => c.tenantId !== t.id); db.tenants = db.tenants.filter(x => x.id !== t.id);
    save(); closeDlg(); render(); toast('Tenant deleted.');
  },
  resetPw: d => {
    const t = tenantOf(d.id); const u = db.users.find(x => x.id === t.userId); if (!u) return;
    if (!confirm(`Reset the password for ${t.name}? Their current password will stop working right away.`)) return;
    const p = randPass(); u.pass = hash(p); save(); credDialog(t.name, u.username, p);
  },
  delRoom: d => {
    if (db.tenants.some(t => t.roomId === d.id)) return toast('Move or remove the tenants in this room first.', true);
    if (!confirm('Delete this room?')) return; db.rooms = db.rooms.filter(r => r.id !== d.id); save(); render();
  },
  recordPay: d => {
    if (!db.tenants.length) return toast('Add a tenant first.', true);
    openDlg('Record payment', payForm(d.id || db.tenants[0].id, true)); syncAmount();
  },
  confirmPay: d => {
    const p = db.payments.find(x => x.id === d.id); const t = tenantOf(p.tenantId); const i = monthInfo(t, p.month);
    if (i.paid + p.amount > i.rent + 0.001) return toast('This would exceed the rent for that month. Reject or void another payment first.', true);
    p.status = 'confirmed'; p.confirmedAt = p.resolvedAt = new Date().toISOString(); save(); render(); toast('Payment confirmed.');
  },
  rejectPay: d => {
    const why = prompt('Reason for rejecting (the tenant will see this):', 'Payment not received'); if (why === null) return;
    const p = db.payments.find(x => x.id === d.id); p.status = 'rejected'; p.note = why; p.resolvedAt = new Date().toISOString(); save(); render(); toast('Payment rejected.');
  },
  voidPay: d => {
    if (!confirm('Void this confirmed payment? The balance will increase again.')) return;
    const p = db.payments.find(x => x.id === d.id); p.status = 'rejected'; p.note = 'Voided by owner'; p.resolvedAt = new Date().toISOString(); save(); render(); toast('Payment voided.');
  },
  respond: d => {
    const c = db.complaints.find(x => x.id === d.id);
    openDlg('Respond to report', `<p><b>${esc(c.subject)}</b></p><p class="muted">${esc(c.message)}</p><form data-form="respond"><input type="hidden" name="id" value="${c.id}">
      <div class="field"><label>Status</label><select name="status">${['open', 'in_progress', 'resolved'].map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></div>
      <div class="field"><label>Reply to tenant</label><textarea name="reply">${esc(c.reply)}</textarea></div><button class="btn primary block">Save</button></form>`);
  },
  payNow: d => { ui.payMonth = d.ym || ''; ui.page = 'pay'; render(); },
  backup: () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    a.download = `oppa-yopa-backup-${todayStr()}.json`; a.click(); URL.revokeObjectURL(a.href);
  },
  resetAll: () => {
    if (!confirm('Erase ALL data and restore the demo data?')) return;
    localStorage.removeItem(KEY); localStorage.removeItem(SESSION); db = load(); me = null; render();
  }
};

document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeDlg();
  if (e.target.id === 'dlg') return closeDlg();
  const el = e.target.closest('[data-action]'); if (!el) return;
  const fn = actions[el.dataset.action]; if (fn) fn(el.dataset);
});
document.addEventListener('submit', e => {
  const name = e.target.dataset.form; if (!name) return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (forms[name]) forms[name](f, e.target);
});
/* live search / filters re-render just the list so typing keeps focus */
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.live;
  if (k) { ui[k] = e.target.value; refreshRows(); return; }
  if (e.target.id === 'tf-name') { const u = $('#tf-user'); if (u && !u.dataset.dirty) u.value = slug(e.target.value); }
  if (e.target.id === 'tf-user') e.target.dataset.dirty = '1';
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.live;
  if (k) { ui[k] = e.target.value; refreshRows(); return; }
  if (e.target.id === 'tf-room') { const o = e.target.selectedOptions[0]; if (o) $('#tf-rent').value = o.dataset.rate; }
  if (e.target.id === 'pf-t') { const t = tenantOf(e.target.value); $('#pf-m').innerHTML = monthOptions(t); syncAmount(); }
  if (e.target.id === 'pf-m') syncAmount();
});
function refreshRows() {
  refreshRowsRaw();
  labelTables($('#rows'));
}
function refreshRowsRaw() {
  const box = $('#rows'); if (!box) return;
  if (ui.page === 'tenants') box.innerHTML = tenantRows();
  else if (ui.page === 'payments') box.innerHTML = paymentRows();
  else if (ui.page === 'complaints') box.innerHTML = complaintCards(db.complaints.filter(c => ui.cf === 'all' || c.status === ui.cf).sort((a, b) => b.date.localeCompare(a.date)), true);
}
