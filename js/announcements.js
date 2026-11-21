'use strict';

/*  Announcement Panel*/
const annFor = t => db.announcements.filter(a => !a.roomId || a.roomId === t.roomId).sort((a, b) => b.date.localeCompare(a.date));
const annTargets = a => db.tenants.filter(t => !a.roomId || t.roomId === a.roomId);
const annAudience = a => a.roomId ? `${roomName(a.roomId)} only` : 'All tenants';
function unreadAnn() {
  const t = me && myTenant(); if (!t) return [];
  const seen = me.seenAnn || [];
  return annFor(t).filter(a => !seen.includes(a.id));
}
const annBody = s => esc(s).replace(/\n/g, '<br>');

function pgAnnounce() {
  const list = [...db.announcements].sort((a, b) => b.date.localeCompare(a.date));
  const roomOpts = db.rooms.map(r => `<option value="${r.id}">${esc(r.name)} only</option>`).join('');
  return `<div class="page-head"><div><h2>Announcements</h2><p>Post a notice your tenants will see when they sign in.</p></div></div>
  <div class="two"><div class="card"><h3>New announcement</h3><form data-form="announce">
    <div class="grid2"><div class="field"><label for="an-to">Send to</label><select id="an-to" name="audience"><option value="all">All tenants</option>${roomOpts}</select></div>
    <div class="field"><label for="an-pr">Priority</label><select id="an-pr" name="priority"><option value="normal">Normal</option><option value="important">Important</option></select></div></div>
    <div class="field"><label for="an-t">Title</label><input id="an-t" name="title" maxlength="80" required placeholder="e.g. Water interruption on Friday"></div>
    <div class="field"><label for="an-m">Message</label><textarea id="an-m" name="message" required></textarea></div>
    <button class="btn primary">Post announcement</button></form></div>
  <div class="card"><h3>Posted (${list.length})</h3>${list.length ? list.map(a => {
    const tg = annTargets(a);
    const seen = tg.filter(t => { const u = db.users.find(x => x.id === t.userId); return u && (u.seenAnn || []).includes(a.id); }).length;
    return `<div class="cmp"><div class="cmp-head"><b>${esc(a.title)}</b>${a.priority === 'important' ? badge('important') : ''}</div>
      <div class="muted small">To: ${esc(annAudience(a))} · ${fmtDate(a.date)} · Seen by ${seen} of ${tg.length}</div>
      <p style="margin:8px 0">${annBody(a.message)}</p>
      <button class="btn sm danger" data-action="delAnn" data-id="${a.id}">Delete</button></div>`;
  }).join('') : empty('Nothing posted yet.')}</div></div>`;
}

function pgNotices() {
  const t = myTenant(); if (!t) return noLease();
  const fresh = unreadAnn().map(a => a.id);
  const list = annFor(t);
  // opening this page counts as reading; the "New" tags below still show for this visit
  if (fresh.length) { me.seenAnn = [...new Set([...(me.seenAnn || []), ...fresh])]; save(); }
  return `<div class="page-head"><div><h2>Announcements</h2><p>Notices from your owner.</p></div></div>
  <div class="card">${list.length ? list.map(a => `<div class="cmp"><div class="cmp-head"><b>${esc(a.title)}</b><span>${fresh.includes(a.id) ? badge('new') + ' ' : ''}${a.priority === 'important' ? badge('important') : ''}</span></div>
    <div class="muted small">${fmtDate(a.date)}</div><p style="margin:8px 0 0">${annBody(a.message)}</p></div>`).join('') : empty('No announcements yet.')}</div>`;
}

/* Panel shown once after signing in: what needs attention (owner) or what changed (tenant) */
function listItems(arr, fn, max = 5) {
  const out = arr.slice(0, max).map(fn);
  if (arr.length > max) out.push(`<li class="muted">and ${arr.length - max} more</li>`);
  return out;
}
function showWelcome(prev) {
  const isNew = iso => !prev || (iso && iso > prev);
  const tag = iso => isNew(iso) ? ' <span class="badge new">New</span>' : '';
  const sec = (title, items, page, label) => items.length
    ? `<div class="wl-sec"><h4>${title}</h4><ul class="wl-list">${items.join('')}</ul><button class="btn sm" data-action="goto" data-id="${page}">${label}</button></div>` : '';
  let title, body = '';
  if (me.role === 'owner') {
    title = 'While you were away';
    const pend = db.payments.filter(p => p.status === 'pending').sort((a, b) => b.date.localeCompare(a.date));
    const open = db.complaints.filter(c => c.status === 'open').sort((a, b) => b.date.localeCompare(a.date));
    const over = db.tenants.filter(t => tenantStatus(t).status === 'overdue');
    body = sec(`${plural(pend.length, 'payment')} waiting for your confirmation`, listItems(pend, p => {
      const t = tenantOf(p.tenantId);
      return `<li><b>${esc(t ? t.name : 'A tenant')}</b> paid ${peso(p.amount)} for ${ymLabel(p.month)} via ${METHOD[p.method]}${p.ref ? ' (ref ' + esc(p.ref) + ')' : ''}.${tag(p.date)}</li>`;
    }), 'payments', 'Review payments')
      + sec(`${plural(open.length, 'new report')} from tenants`, listItems(open, c => {
        const t = tenantOf(c.tenantId);
        return `<li><b>${esc(t ? t.name : 'A tenant')}</b>: ${esc(c.subject)}.${tag(c.date)}</li>`;
      }), 'complaints', 'Read reports')
      + sec(`${plural(over.length, 'tenant')} with overdue rent`, listItems(over, t => `<li><b>${esc(t.name)}</b> owes ${peso(tenantStatus(t).balance)}.</li>`), 'tenants', 'View tenants');
  } else {
    const t = myTenant(); if (!t) return;
    title = `Welcome back, ${me.name.split(' ')[0]}`;
    const anns = unreadAnn();
    const pays = db.payments.filter(p => p.tenantId === t.id && p.resolvedAt && isNew(p.resolvedAt));
    const reps = db.complaints.filter(c => c.tenantId === t.id && c.updatedAt && isNew(c.updatedAt));
    body = sec(`${plural(anns.length, 'new announcement')}`, listItems(anns, a => `<li><b>${esc(a.title)}</b>${a.priority === 'important' ? ' ' + badge('important') : ''}<div class="muted small">${fmtDate(a.date)}</div></li>`), 'notices', 'Read announcements')
      + sec('Payment updates', listItems(pays, p => `<li>Your ${peso(p.amount)} payment for ${ymLabel(p.month)} was ${p.status === 'confirmed' ? 'confirmed' : 'rejected' + (p.note ? ': ' + esc(p.note) : '')}.</li>`), 'history', 'View payments')
      + sec('Report updates', listItems(reps, c => `<li>Your owner updated “${esc(c.subject)}” to <b>${STATUS_LABEL[c.status]}</b>.</li>`), 'reports', 'View reports');
  }
  if (!body) return;
  openDlg(title, body + '<div class="actions"><button class="btn primary" data-close>Got it</button></div>');
}
