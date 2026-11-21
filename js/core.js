'use strict';

'use strict';

/* ---------- Helpers ---------- */
const KEY = 'oppa_yopa_v1', SESSION = 'oppa_yopa_session';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const peso = n => { n = Number(n || 0); const whole = Math.abs(n - Math.round(n)) < 0.005; return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }); };
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toISO(new Date());
const curYM = () => todayStr().slice(0, 7);
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const ymLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }); };
const fmtDate = s => { if (!s) return '—'; const d = new Date(s.length === 10 ? s + 'T00:00:00' : s); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };
const fmtShort = s => { const d = new Date(s); return d.toLocaleDateString('en-US', d.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' }); };
const hash = str => { let h = 5381; const s = 'be$' + str; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); };
const randPass = () => { const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let p = ''; for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)]; return p; };
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 20);
const METHOD = { cash: 'Cash', gcash: 'GCash', bank: 'Bank transfer' };
const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', overdue: 'Overdue', unpaid: 'Unpaid', upcoming: 'Upcoming', pending: 'Pending confirmation', confirmed: 'Confirmed', rejected: 'Rejected', open: 'Open', in_progress: 'In progress', resolved: 'Resolved', important: 'Important', new: 'New' };
const badge = (st, label) => `<span class="badge ${st}"><i></i>${esc(label || STATUS_LABEL[st] || st)}</span>`;

/* ---------- Data layer ---------- */
function seed() {
  const start = addMonths(curYM(), -2) + '-01';
  const r1 = { id: uid(), name: 'Room 1', capacity: 3, rate: 2500 };
  const r2 = { id: uid(), name: 'Room 2', capacity: 3, rate: 2800 };
  const owner = { id: uid(), username: 'owner', pass: hash('owner123'), role: 'owner', name: 'Boarding House Owner' };
  const tu = { id: uid(), username: 'juan', pass: hash('tenant123'), role: 'tenant', name: 'Juan Dela Cruz' };
  const t = { id: uid(), userId: tu.id, name: 'Juan Dela Cruz', contact: '0917 000 0000', roomId: r1.id, rent: 2500, deposit: 2500, start, months: 12, dueDay: 5 };
  const now = new Date().toISOString();
  const pay = (month, amount, method, ref, status) => ({ id: uid(), tenantId: t.id, month, amount, method, ref, note: '', status, date: now, by: method === 'cash' ? 'owner' : 'tenant' });
  return {
    users: [owner, tu],
    rooms: [r1, r2],
    tenants: [t],
    payments: [
      pay(addMonths(curYM(), -2), 2500, 'cash', '', 'confirmed'),
      pay(addMonths(curYM(), -1), 1000, 'gcash', '09171234567', 'confirmed')
    ],
    complaints: [],
    announcements: [{ id: uid(), title: 'Welcome to Oppa Yopa', message: 'Notices from your owner will show up here.', priority: 'normal', roomId: null, date: now }],
    settings: { boardName: 'Oppa Yopa Dorm', gcashName: '', gcashNumber: '', bankName: '', bankAcct: '', bankHolder: '', instructions: '' }
  };
}
function load() {
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.users) { r.announcements = r.announcements || []; return r; } } catch (e) { /* ignore */ }
  const d = seed(); localStorage.setItem(KEY, JSON.stringify(d)); return d;
}
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

let db, me = null;
const ui = { page: 'dashboard', tq: '', tf: 'all', pq: '', pf: 'all', cf: 'all', payMonth: '' };

/* ---------- Business logic ---------- */
const monthsOf = t => Array.from({ length: t.months }, (_, i) => addMonths(t.start.slice(0, 7), i));
const roomOf = id => db.rooms.find(r => r.id === id);
const roomName = id => (roomOf(id) || { name: '—' }).name;
const tenantOf = id => db.tenants.find(t => t.id === id);
const myTenant = () => db.tenants.find(t => t.userId === me.id);
const leaseEnd = t => { const d = new Date(t.start + 'T00:00:00'); d.setMonth(d.getMonth() + Number(t.months)); d.setDate(d.getDate() - 1); return toISO(d); };

/* Lease length in real days (start and end dates both count) */
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
function leaseDays(t) {
  const end = leaseEnd(t), today = todayStr(), total = dayDiff(t.start, end) + 1;
  if (today < t.start) return { state: 'upcoming', total, elapsed: 0, left: total, startsIn: dayDiff(today, t.start), endedAgo: 0 };
  if (today > end) return { state: 'ended', total, elapsed: total, left: 0, startsIn: 0, endedAgo: dayDiff(end, today) };
  const elapsed = dayDiff(t.start, today) + 1;
  return { state: 'active', total, elapsed, left: total - elapsed, startsIn: 0, endedAgo: 0 };
}
function leaseShort(t) {
  const L = leaseDays(t);
  return L.state === 'active' ? `${plural(L.left, 'day')} left` : L.state === 'upcoming' ? `Starts in ${plural(L.startsIn, 'day')}` : 'Lease ended';
}
function leaseDetail(t) {
  const L = leaseDays(t), pct = Math.round(L.elapsed / L.total * 100);
  const line = L.state === 'active' ? `Day ${L.elapsed} of ${L.total} · ${plural(L.left, 'day')} left`
    : L.state === 'upcoming' ? `Starts in ${plural(L.startsIn, 'day')}` : `Ended ${plural(L.endedAgo, 'day')} ago`;
  return `${plural(L.total, 'day')} (${plural(+t.months, 'month')})<div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div><div class="muted small">${line}</div>`;
}

/* Online payment methods the owner has set up */
function channels() {
  const s = db.settings, c = [];
  if ((s.gcashNumber || '').trim()) c.push('gcash');
  if ((s.bankAcct || '').trim()) c.push('bank');
  return c;
}

function monthInfo(t, ym) {
  const rent = +t.rent;
  const amounts = paymentAllocations(t).byMonth.get(ym) || { paid: 0, pending: 0, methods: [] };
  const paid = amounts.paid;
  const pending = amounts.pending;
  const balance = Math.max(+(rent - paid).toFixed(2), 0);
  const due = `${ym}-${pad(Math.min(+t.dueDay, 28))}`;
  let status;
  if (balance <= 0) status = 'paid';
  else if (todayStr() > due) status = 'overdue';
  else if (paid > 0) status = 'partial';
  else if (ym > curYM()) status = 'upcoming';
  else status = 'unpaid';
  const methods = amounts.methods;
  return { ym, rent, paid, pending, balance, due, status, methods, partial: paid > 0 && balance > 0 };
}
function paymentAllocations(t) {
  const months = monthsOf(t);
  const totals = new Map(months.map(ym => [ym, { paid: 0, pending: 0, methods: new Set() }]));
  const remaining = new Map(months.map(ym => [ym, +t.rent]));
  const payments = db.payments
    .filter(p => p.tenantId === t.id && ['confirmed', 'pending'].includes(p.status) && months.includes(p.month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const allocations = new Map();
  payments.forEach(p => {
    let amount = Math.max(Number(p.amount) || 0, 0);
    const allocation = { unapplied: amount };
    const targetIndex = months.indexOf(p.month);
    const allocationOrder = [p.month, ...months.filter((ym, i) => i !== targetIndex)];
    for (const ym of allocationOrder) {
      if (amount <= 0) break;
      const available = remaining.get(ym);
      const applied = Math.min(amount, available);
      if (applied <= 0) continue;
      remaining.set(ym, +(available - applied).toFixed(2));
      amount = +(amount - applied).toFixed(2);
      const total = totals.get(ym);
      const bucket = p.status === 'confirmed' ? 'paid' : 'pending';
      total[bucket] = +(total[bucket] + applied).toFixed(2);
      if (p.status === 'confirmed') total.methods.add(p.method);
    }
    allocation.unapplied = amount;
    allocations.set(p.id, allocation);
  });
  return {
    byMonth: new Map([...totals].map(([ym, total]) => [ym, {
      paid: total.paid,
      pending: total.pending,
      methods: [...total.methods],
      remaining: remaining.get(ym)
    }])),
    byPayment: allocations
  };
}
function tenantStatus(t) {
  const now = curYM();
  const infos = monthsOf(t).filter(m => m <= now).map(m => monthInfo(t, m));
  const has = s => infos.some(i => i.status === s);
  const status = !infos.length ? 'upcoming' : has('overdue') ? 'overdue' : has('partial') ? 'partial' : has('unpaid') ? 'unpaid' : 'paid';
  return { status, balance: infos.reduce((a, i) => a + i.balance, 0), partial: infos.some(i => i.partial), infos };
}
const infoBadge = i => badge(i.status, i.status === 'overdue' && i.partial ? 'Overdue (partial)' : null);
const statusBadge = s => badge(s.status, s.status === 'overdue' && s.partial ? 'Overdue (partial)' : null);
const availFor = (t, ym) => {
  const a = paymentAllocations(t).byMonth.get(ym);
  return a ? Math.max(a.remaining, 0) : 0;
};
const maxPayableFrom = (t, ym) => {
  const allocations = paymentAllocations(t).byMonth, months = monthsOf(t);
  if (!months.includes(ym)) return 0;
  return +months.reduce((sum, month) => sum + (allocations.get(month) || { remaining: 0 }).remaining, 0).toFixed(2);
};
function monthOptions(t, sel) {
  const html = monthsOf(t).map(ym => { const a = availFor(t, ym); return a > 0 ? `<option value="${ym}" ${ym === sel ? 'selected' : ''}>${ymLabel(ym)} — ${peso(a)} payable</option>` : ''; }).join('');
  return html || '<option value="">No months left to pay</option>';
}

/* ---------- UI utilities ---------- */
function toast(msg, err) {
  const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
  $('#toast').appendChild(el); setTimeout(() => el.remove(), 3200);
}
function openDlg(title, body, wide) {
  const d = $('#dlg'); d.className = wide ? 'wide' : '';
  d.innerHTML = `<div class="dlg-head"><h3>${esc(title)}</h3><button class="x" data-close aria-label="Close">×</button></div><div class="dlg-body">${body}</div>`;
  labelTables(d);
  if (!d.open) d.showModal();
}
const closeDlg = () => { const d = $('#dlg'); if (d.open) d.close(); };

/* Adds column labels to table cells so the CSS can turn rows into cards on small screens */
function labelTables(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('table').forEach(tb => {
    const heads = [...tb.querySelectorAll('thead th')].map(h => h.textContent.trim());
    tb.classList.add('resp');
    tb.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => {
      if (td.dataset.label !== undefined || td.classList.contains('nolabel')) return;
      if (heads[i]) { td.dataset.label = heads[i]; td.innerHTML = '<div class="cv">' + td.innerHTML + '</div>'; }
      else td.classList.add('nolabel');
    }));
  });
}
function empty(msg) { return `<div class="empty">${esc(msg)}</div>`; }

/* ---------- Auth ---------- */
function login(f) {
  const u = db.users.find(x => x.username === f.username.trim().toLowerCase());
  if (!u || u.pass !== hash(f.password)) return toast('Wrong username or password.', true);
  const prev = u.lastLogin || null;
  me = u; localStorage.setItem(SESSION, u.id); ui.page = u.role === 'owner' ? 'dashboard' : 'lease'; render();
  showWelcome(prev);
  u.lastLogin = new Date().toISOString(); save();
}
function logout() { me = null; localStorage.removeItem(SESSION); render(); }

function loginView() {
  const sample = ['paid', 'paid', 'paid', 'paid', 'partial', 'paid', 'paid', 'overdue', 'paid', 'paid', 'unpaid', 'upcoming'];
  return `<div class="login">
    <section class="login-art"><div class="brand">${LOGO}<div><b>Oppa Yopa</b></div></div>
      <div><h1>Know if your 'Oppa' has been paid or not.</h1>
      <p>Rent, leases and tenant reports for your boarding house, in one place.</p>
      <span class="strip big" aria-hidden="true">${sample.map(k => `<i class="m ${k}"></i>`).join('')}</span></div>
      <small>Records are saved in this browser.</small></section>
    <form class="login-form" data-form="login">
      <h2>Sign in</h2>
      <p class="muted">Tenants: use the login your owner gave you.</p>
      <div class="field"><label for="lu">Username</label><input id="lu" name="username" autocomplete="username" required autofocus></div>
      <div class="field"><label for="lp">Password</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn primary block">Sign in</button>
      <details class="demo"><summary>Demo accounts</summary><p>Owner: <code>owner</code> / <code>owner123</code><br>Tenant: <code>juan</code> / <code>tenant123</code></p></details>
    </form></div>`;
}
