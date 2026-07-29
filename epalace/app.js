// ---------------------------------------------------------------------------
// E-Palace client app: Firebase Auth login + shell + Items/Customers modules.
// ---------------------------------------------------------------------------
(function () {
    'use strict';
    const A = window.EpalaceAuth, D = window.EpalaceData;
    const app = () => document.getElementById('app');
    const $ = (s, r) => (r || document).querySelector(s);

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function money(n) { return '₹' + (Number(n) || 0).toFixed(2); }
    function toast(msg, kind) { const t = document.getElementById('toast'); t.textContent = msg; t.className = kind === 'err' ? 'err' : 'ok'; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 4500); }

    // ---------------- boot ----------------
    function boot() {
        if (!window.epalaceFirebaseConfigured || !window.epalaceFirebaseConfigured()) {
            app().innerHTML = '<div class="login-wrap"><div class="login-card"><h1>Not configured</h1><p class="sub">Set your Firebase web config in <code>firebase-config.js</code>.</p></div></div>';
            return;
        }
        if (A.isLoggedIn()) renderShell(); else renderLogin();
    }

    // ---------------- login ----------------
    function renderLogin() {
        app().innerHTML = `<div class="login-wrap"><form class="login-card" id="loginForm">
      <div class="login-logo">EP</div><h1>E-Palace</h1><p class="sub">Sign in to continue</p>
      <div class="field"><label class="lbl">Email</label><input class="form-control" id="email" type="email" autocomplete="username" required></div>
      <div class="field"><label class="lbl">Password</label><input class="form-control" id="password" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-brand" id="loginBtn" style="width:100%;justify-content:center;margin-top:6px;">Sign in</button>
      <p id="loginMsg" style="color:var(--danger);margin:14px 0 0;min-height:1em;font-size:13px;text-align:center;"></p>
    </form></div>`;
        $('#loginForm').addEventListener('submit', async e => {
            e.preventDefault();
            const btn = $('#loginBtn'), msg = $('#loginMsg');
            btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…'; msg.textContent = '';
            try { await A.signIn($('#email').value.trim(), $('#password').value); renderShell(); }
            catch (err) { msg.textContent = err.message; btn.disabled = false; btn.textContent = 'Sign in'; }
        });
    }

    // ---------------- shell ----------------
    const NAV = [
        { h: '#/dashboard', i: '📊', t: 'Dashboard' },
        { sect: 'Masters' },
        { h: '#/items', i: '📦', t: 'Items' },
        { h: '#/customers', i: '👥', t: 'Customers' },
        { sect: 'Transactions' },
        { ext: 'offline-order.html', i: '🧾', t: 'New Order' }
    ];
    function renderShell() {
        const user = A.currentUser();
        app().innerHTML = `<div class="shell">
      <div class="brand"><div class="mk">EP</div><b>E-Palace</b></div>
      <div class="topbar"><div style="display:flex;align-items:center;gap:10px;"><button class="hamburger" id="ham">☰</button><span class="title" id="pageTitle">…</span></div>
        <div class="user"><span>${esc(user ? user.email : '')}</span><button class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button></div></div>
      <nav class="side" id="side">${NAV.map(n => n.sect ? `<div class="sect">${n.sect}</div>` : `<a href="${n.ext || n.h}" data-h="${n.h || ''}"><span>${n.i}</span><span>${n.t}</span></a>`).join('')}</nav>
      <main class="main" id="view"></main></div>`;
        $('#logoutBtn').addEventListener('click', () => { A.signOut(); location.hash = ''; renderLogin(); });
        $('#ham').addEventListener('click', () => $('#side').classList.toggle('open'));
        window.onhashchange = route;
        if (!location.hash) location.hash = '#/dashboard';
        route();
    }
    function route() {
        const side = $('#side'); if (side) side.classList.remove('open');
        document.querySelectorAll('.side a').forEach(a => a.classList.toggle('active', a.getAttribute('data-h') === location.hash));
        const view = $('#view'), title = $('#pageTitle');
        if (!view) return;
        const h = location.hash;
        if (h.indexOf('#/items') === 0) { title.textContent = 'Items'; ItemsView(view); }
        else if (h.indexOf('#/customers') === 0) { title.textContent = 'Customers'; CustomersView(view); }
        else { title.textContent = 'Dashboard'; DashboardView(view); }
    }

    function loading(view) { view.innerHTML = '<div class="empty"><span class="spinner"></span> Loading…</div>'; }
    function errorBox(view, err) {
        const perm = /permission|PERMISSION|insufficient/i.test(err.message);
        view.innerHTML = `<div class="card card-pad"><h3 style="margin-top:0;">Couldn't load data</h3>
      <p style="color:var(--muted)">${esc(err.message)}</p>
      ${perm ? '<p style="color:var(--warn)">This usually means the Firestore security rules don\'t allow this yet. Publish the updated rules from the setup guide.</p>' : ''}</div>`;
    }

    // ---------------- modal ----------------
    function openModal(title, bodyHTML, onSave) {
        const back = document.createElement('div');
        back.className = 'modal-back';
        back.innerHTML = `<div class="modal"><h3>${esc(title)}</h3><div class="body">${bodyHTML}</div>
      <div class="foot"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-brand" data-save>Save</button></div></div>`;
        document.body.appendChild(back);
        const close = () => back.remove();
        back.querySelector('[data-x]').onclick = close;
        back.addEventListener('mousedown', e => { if (e.target === back) close(); });
        back.querySelector('[data-save]').onclick = async () => {
            const btn = back.querySelector('[data-save]');
            btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
            try { await onSave(back); close(); }
            catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'Save'; }
        };
        return back;
    }
    const val = (b, id) => $('#' + id, b).value;
    const numv = (b, id) => { const v = parseFloat($('#' + id, b).value); return isNaN(v) ? 0 : v; };
    const intv = (b, id) => { const v = parseInt($('#' + id, b).value, 10); return isNaN(v) ? 0 : v; };
    const chk = (b, id) => $('#' + id, b).checked;

    // ---------------- Dashboard ----------------
    async function DashboardView(view) {
        loading(view);
        try {
            const [items, customers] = await Promise.all([D.list('items'), D.list('customers')]);
            const low = items.filter(i => (i.StockQty || 0) <= (i.ReorderLevel || 0)).length;
            view.innerHTML = `<div class="page-head"><h2>Dashboard</h2></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;">
          ${kpi('Items', items.length)} ${kpi('Customers', customers.length)} ${kpi('Low stock', low, low ? 'low' : '')}
        </div>
        <div class="card card-pad" style="margin-top:18px;color:var(--muted)">Welcome to E-Palace. Use the menu to manage Items and Customers, or tap <b>New Order</b> for field order entry.</div>`;
        } catch (err) { errorBox(view, err); }
    }
    function kpi(label, n, cls) { return `<div class="card card-pad"><div style="color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em;">${label}</div><div class="num" style="font-size:30px;font-weight:700;margin-top:4px;color:${cls === 'low' ? '#fbbf24' : '#fff'}">${n}</div></div>`; }

    // ---------------- Items ----------------
    let itemsCache = [];
    async function ItemsView(view) {
        loading(view);
        try {
            itemsCache = (await D.list('items')).sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            view.innerHTML = `<div class="page-head"><h2>Items</h2><button class="btn btn-brand" id="addItem">+ Add Item</button></div>
        <div class="toolbar"><input class="form-control" id="itemSearch" placeholder="Search items…" style="max-width:280px;"></div>
        <div class="card" style="overflow:auto;"><table class="tbl"><thead><tr>
          <th>Code</th><th>Name</th><th class="right">Supplier</th><th class="right">Selling</th><th class="right">Stock</th><th>Status</th><th></th>
        </tr></thead><tbody id="itemRows"></tbody></table></div>`;
            $('#addItem').onclick = () => itemForm();
            $('#itemSearch').addEventListener('input', e => renderItemRows(e.target.value));
            renderItemRows('');
        } catch (err) { errorBox(view, err); }
    }
    function renderItemRows(q) {
        q = (q || '').toLowerCase();
        const rows = itemsCache.filter(i => !q || (i.Name || '').toLowerCase().includes(q) || (i.Code || '').toLowerCase().includes(q));
        const tb = $('#itemRows');
        if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">No items.</td></tr>'; return; }
        tb.innerHTML = rows.map(i => {
            const low = (i.StockQty || 0) <= (i.ReorderLevel || 0);
            return `<tr>
        <td>${esc(i.Code || '')}</td><td><b>${esc(i.Name)}</b><br><small style="color:var(--muted)">${esc(i.Description || '')}</small></td>
        <td class="right num">${money(i.SupplierRate)}</td><td class="right num">${money(i.SellingRate)}</td>
        <td class="right num">${i.StockQty || 0} ${low ? '<span class="pill low">low</span>' : ''}</td>
        <td>${i.IsActive === false ? '<span class="pill off">inactive</span>' : '<span class="pill on">active</span>'}</td>
        <td class="right"><button class="btn btn-ghost btn-sm" data-edit="${esc(i.id)}">Edit</button></td></tr>`;
        }).join('');
        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => itemForm(itemsCache.find(x => x.id === b.getAttribute('data-edit'))));
    }
    function itemForm(item) {
        const it = item || {};
        const body = `
      <div class="grid2">
        <div class="field"><label class="lbl">Item Code</label><input class="form-control" id="f_code" value="${esc(it.Code || '')}"></div>
        <div class="field"><label class="lbl">Name *</label><input class="form-control" id="f_name" value="${esc(it.Name || '')}"></div>
      </div>
      <div class="field"><label class="lbl">Description</label><input class="form-control" id="f_desc" value="${esc(it.Description || '')}"></div>
      <div class="grid2">
        <div class="field"><label class="lbl">Supplier Rate</label><input class="form-control" id="f_sup" type="number" step="0.01" value="${it.SupplierRate || 0}"></div>
        <div class="field"><label class="lbl">Selling Rate</label><input class="form-control" id="f_sell" type="number" step="0.01" value="${it.SellingRate || 0}"></div>
        <div class="field"><label class="lbl">Stock Qty</label><input class="form-control" id="f_stock" type="number" value="${it.StockQty || 0}"></div>
        <div class="field"><label class="lbl">Reorder Level</label><input class="form-control" id="f_reorder" type="number" value="${it.ReorderLevel || 0}"></div>
      </div>
      <div class="field"><label class="lbl"><input type="checkbox" id="f_active" ${it.IsActive === false ? '' : 'checked'}> Active</label></div>`;
        openModal(item ? 'Edit Item' : 'Add Item', body, async (b) => {
            const name = val(b, 'f_name').trim();
            if (!name) throw new Error('Item name is required.');
            if (numv(b, 'f_sell') < numv(b, 'f_sup')) throw new Error('Selling rate must be ≥ supplier rate.');
            const data = {
                Code: val(b, 'f_code').trim(), Name: name, Description: val(b, 'f_desc').trim(),
                SupplierRate: numv(b, 'f_sup'), SellingRate: numv(b, 'f_sell'),
                StockQty: intv(b, 'f_stock'), ReorderLevel: intv(b, 'f_reorder'),
                IsActive: chk(b, 'f_active'), UpdatedAtUtc: new Date()
            };
            if (item) { await D.update('items', item.id, data); toast('Item updated.'); }
            else { data.ItemID = Date.now(); await D.create('items', data); toast('Item added.'); }
            ItemsView($('#view'));
        });
    }

    // ---------------- Customers ----------------
    let custCache = [];
    async function CustomersView(view) {
        loading(view);
        try {
            custCache = (await D.list('customers')).sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
            view.innerHTML = `<div class="page-head"><h2>Customers</h2><button class="btn btn-brand" id="addCust">+ Add Customer</button></div>
        <div class="toolbar"><input class="form-control" id="custSearch" placeholder="Search customers…" style="max-width:280px;"></div>
        <div class="card" style="overflow:auto;"><table class="tbl"><thead><tr>
          <th>Name</th><th>Phone</th><th>City</th><th>GSTIN</th><th>Status</th><th></th>
        </tr></thead><tbody id="custRows"></tbody></table></div>`;
            $('#addCust').onclick = () => custForm();
            $('#custSearch').addEventListener('input', e => renderCustRows(e.target.value));
            renderCustRows('');
        } catch (err) { errorBox(view, err); }
    }
    function renderCustRows(q) {
        q = (q || '').toLowerCase();
        const rows = custCache.filter(c => !q || (c.Name || '').toLowerCase().includes(q) || (c.PhoneNumber || '').includes(q));
        const tb = $('#custRows');
        if (!rows.length) { tb.innerHTML = '<tr><td colspan="6" class="empty">No customers.</td></tr>'; return; }
        tb.innerHTML = rows.map(c => `<tr>
        <td><b>${esc(c.Name)}</b><br><small style="color:var(--muted)">${esc(c.Address || '')}</small></td>
        <td>${esc(c.PhoneNumber || '')}</td><td>${esc(c.City || '')}</td><td>${esc(c.GSTIN || '')}</td>
        <td>${c.IsActive === false ? '<span class="pill off">inactive</span>' : '<span class="pill on">active</span>'}</td>
        <td class="right"><button class="btn btn-ghost btn-sm" data-edit="${esc(c.id)}">Edit</button></td></tr>`).join('');
        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => custForm(custCache.find(x => x.id === b.getAttribute('data-edit'))));
    }
    function custForm(cust) {
        const c = cust || {};
        const body = `
      <div class="grid2">
        <div class="field"><label class="lbl">Name *</label><input class="form-control" id="c_name" value="${esc(c.Name || '')}"></div>
        <div class="field"><label class="lbl">Phone *</label><input class="form-control" id="c_phone" value="${esc(c.PhoneNumber || '')}"></div>
      </div>
      <div class="field"><label class="lbl">Address</label><input class="form-control" id="c_addr" value="${esc(c.Address || '')}"></div>
      <div class="grid2">
        <div class="field"><label class="lbl">City</label><input class="form-control" id="c_city" value="${esc(c.City || '')}"></div>
        <div class="field"><label class="lbl">GSTIN</label><input class="form-control" id="c_gstin" value="${esc(c.GSTIN || '')}"></div>
        <div class="field"><label class="lbl">Email</label><input class="form-control" id="c_email" type="email" value="${esc(c.Email || '')}"></div>
      </div>
      <div class="field"><label class="lbl"><input type="checkbox" id="c_active" ${c.IsActive === false ? '' : 'checked'}> Active</label></div>`;
        openModal(cust ? 'Edit Customer' : 'Add Customer', body, async (b) => {
            const name = val(b, 'c_name').trim(), phone = val(b, 'c_phone').trim();
            if (!name) throw new Error('Customer name is required.');
            if (!phone) throw new Error('Phone number is required.');
            const data = {
                Name: name, PhoneNumber: phone, Address: val(b, 'c_addr').trim(),
                City: val(b, 'c_city').trim(), GSTIN: val(b, 'c_gstin').trim(), Email: val(b, 'c_email').trim(),
                IsActive: chk(b, 'c_active')
            };
            if (cust) { await D.update('customers', cust.id, data); toast('Customer updated.'); }
            else { data.CreatedDate = new Date(); await D.create('customers', data); toast('Customer added.'); }
            CustomersView($('#view'));
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
