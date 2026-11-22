'use strict';

db = load();
me = db.users.find(u => u.id === localStorage.getItem(SESSION)) || null;
if (me && me.disabled) {
    localStorage.removeItem(SESSION);
    me = null;
}
if (me) ui.page = me.role === 'owner' ? 'dashboard' : 'lease';
render();