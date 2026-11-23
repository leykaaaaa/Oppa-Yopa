'use strict';

db = load();
let migratedMoveOutLosses = false;
db.tenants.forEach(tenant => {
    if (tenant.movedOut && !Number.isFinite(tenant.writtenOffBalance)) {
        tenant.writtenOffBalance = tenantStatus(tenant).balance;
        migratedMoveOutLosses = true;
    }
});
if (migratedMoveOutLosses) save();

me = db.users.find(u => u.id === localStorage.getItem(SESSION)) || null;
if (me && me.disabled) {
    localStorage.removeItem(SESSION);
    me = null;
}
if (me) ui.page = me.role === 'owner' ? 'dashboard' : 'lease';
render();