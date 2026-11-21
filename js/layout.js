'use strict';

/* Icons and logo*/
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>',
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
ICONS.notices = ICONS.announce; ICONS.reports = ICONS.complaints;
const ico = n => { const icon = ICONS[n] || ''; return icon.startsWith('<i ') ? icon : `<svg class="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`; };
const LOGO = '<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><rect x="7" y="9" width="5" height="14" rx="1.5" fill="#4ade80"/><rect x="13.5" y="9" width="5" height="14" rx="1.5" fill="#fbbf24"/><rect x="20" y="9" width="5" height="14" rx="1.5" fill="#f87171"/></svg>';
const initials = n => n.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* One bar per month so a tenant's payment history reads at a glance */
function stripHTML(t, max = 12) {
  const now = curYM();
  const infos = monthsOf(t).filter(m => m <= now).map(m => monthInfo(t, m)).slice(-max);
  if (!infos.length) return '<span class="muted small">Not started</span>';
  const desc = i => `${ymLabel(i.ym)}: ${STATUS_LABEL[i.status]}${i.paid > 0 ? `, ${peso(i.paid)} of ${peso(i.rent)} paid` : ''}${i.balance > 0 ? ', ' + peso(i.balance) + ' left' : ''}`;
  return `<span class="strip" role="img" aria-label="${esc(infos.map(desc).join('. '))}">${infos.map(i => {
    const progress = i.partial ? Math.min(100, Math.max(0, i.paid / i.rent * 100)) : 0;
    const color = i.status === 'overdue' ? 'var(--overdue)' : 'var(--partial)';
    const background = i.status === 'overdue' ? 'var(--overdue-bg)' : 'var(--partial-bg)';
    const fill = i.partial ? ` style="background:linear-gradient(to top,${color} ${progress}%,${background} ${progress}%)"` : '';
    return `<i class="m ${i.status}"${fill} title="${esc(desc(i))}"></i>`;
  }).join('')}</span>`;
}
const legendHTML = () => `<div class="legend-row">${[['paid', 'Paid'], ['partial', 'Partial'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue']].map(([k, l]) => `<span class="lg"><i class="m ${k}"></i>${l}</span>`).join('')}</div>`;

/* Month tiles for a whole lease; tenants can select a tile to pay that month */
function calendarHTML(t, pay) {
  const now = curYM();
  return `<div class="cal">${monthsOf(t).map(m => {
    const i = monthInfo(t, m), [y, mo] = m.split('-').map(Number);
    const mon = new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'short' });
    const sub = i.status === 'paid' ? 'Paid' : i.status === 'upcoming' ? peso(i.rent) : `${peso(i.balance)} left`;
    const label = `${ymLabel(m)}: ${STATUS_LABEL[i.status]}${i.balance > 0 ? ', ' + peso(i.balance) + ' left' : ''}`;
    const inner = `<span class="mn">${mon}</span><span class="my">${y}</span><span class="ms">${sub}</span>`;
    const cls = `mo ${i.status}${m === now ? ' now' : ''}`;
    return pay && availFor(t, m) > 0
      ? `<button class="${cls}" data-action="payNow" data-ym="${m}" title="${esc(label)}. Select to pay.">${inner}</button>`
      : `<div class="${cls}" title="${esc(label)}">${inner}</div>`;
  }).join('')}</div>`;
}

const OWNER_NAV = [['dashboard', 'Dashboard'], ['tenants', 'Tenants'], ['rooms', 'Rooms'], ['payments', 'Payments'], ['complaints', 'Reports'], ['announce', 'Announcements'], ['settings', 'Settings']];
const TENANT_NAV = [['lease', 'My lease'], ['notices', 'Announcements'], ['pay', 'Pay rent'], ['history', 'My payments'], ['reports', 'Send a report'], ['account', 'Account']];


function navCount(id) {
  if (id === 'payments') return db.payments.filter(p => p.status === 'pending').length;
  if (id === 'complaints') return db.complaints.filter(c => c.status === 'open').length;
  if (id === 'notices') return unreadAnn().length;
  return 0;
}
function render() {
  const app = $('#app');
  if (!me) { app.innerHTML = loginView(); return; }
  const nav = me.role === 'owner' ? OWNER_NAV : TENANT_NAV;
  if (!nav.some(n => n[0] === ui.page)) ui.page = nav[0][0];
  const pages = { dashboard: pgDashboard, tenants: pgTenants, rooms: pgRooms, payments: pgPayments, complaints: pgComplaints, announce: pgAnnounce, notices: pgNotices, settings: pgSettings, lease: pgLease, pay: pgPay, history: pgHistory, reports: pgReports, account: pgAccount };
  const content = pages[ui.page](); // built first so unread badges are current
  app.innerHTML = `<div class="shell"><aside class="side">
    <div class="brand">${LOGO}<div><b>Oppa Yopa</b><small>${esc(db.settings.boardName || '')}</small></div></div>
    <nav class="nav" aria-label="Main">${nav.map(([id, lb]) => { const c = navCount(id); return `<button class="nav-btn ${ui.page === id ? 'active' : ''}" data-action="nav" data-id="${id}"${ui.page === id ? ' aria-current="page"' : ''}>${ico(id)}<span class="lbl">${lb}</span>${c ? `<span class="count">${c}</span>` : ''}</button>`; }).join('')}</nav>
    <div class="spacer"></div>
    <div class="who"><span class="av">${esc(initials(me.name))}</span><div><b>${esc(me.name)}</b><small>${me.role === 'owner' ? 'Owner' : 'Tenant'}</small></div></div>
    <button class="nav-btn logout" data-action="logout">${ico('logout')}<span class="lbl">Log out</span></button>
  </aside><main id="main">${content}</main></div>`;
  labelTables($('#app'));
  if (me.role === 'tenant' && ui.page === 'pay') syncAmount();
}
