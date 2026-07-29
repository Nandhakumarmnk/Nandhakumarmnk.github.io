// ---------------------------------------------------------------------------
// Offline order entry page logic.
//   • Works with ZERO connection: items are read from IndexedDB, new orders are
//     queued in IndexedDB.
//   • When online AND Firebase is configured: "Refresh items" pulls the product
//     list from Firestore, and "Push to cloud" sends queued orders to Firestore
//     (where the web app's Sync button then pulls them into SQL Server).
// The Firebase SDK is imported on demand (only when online), so entry never
// depends on it.
// ---------------------------------------------------------------------------
(function () {
    'use strict';

    const PAYMENT_MODES = [
        { id: 1, name: 'Cash' }, { id: 2, name: 'GPay' }, { id: 3, name: 'UPI' },
        { id: 4, name: 'Card' }, { id: 5, name: 'Bank Transfer' }, { id: 6, name: 'Cheque' }
    ];

    let items = [];
    let lines = [];

    const $ = (id) => document.getElementById(id);
    const money = (n) => '₹' + (Number(n) || 0).toFixed(2);

    function deviceId() {
        let id = localStorage.getItem('epalace-device-id');
        if (!id) {
            id = 'web-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
            localStorage.setItem('epalace-device-id', id);
        }
        return id;
    }

    function newId() {
        return 'offline-' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.round(performance.now()));
    }

    function ensureConfigured() {
        if (!window.epalaceFirebaseConfigured()) {
            throw new Error('Firebase is not configured yet. Edit wwwroot/js/firebase-config.js.');
        }
    }

    // ---- Status ----
    function setStatus() {
        const online = navigator.onLine;
        const el = $('conn-status');
        el.textContent = online ? 'Online' : 'Offline';
        el.className = 'badge ' + (online ? 'bg-success' : 'bg-secondary');
        const cfg = window.epalaceFirebaseConfigured();
        $('cfg-status').style.display = cfg ? 'none' : '';
    }

    async function updateQueueCount() {
        const q = await window.EpalaceDB.getQueue();
        $('queue-count').textContent = q.length;
        renderQueue(q);
    }

    // ---- Items ----
    async function loadItems() {
        items = await window.EpalaceDB.getItems();
        const sel = $('item-select');
        sel.innerHTML = '<option value="">— select item —</option>' +
            items.map(i => `<option value="${i.ItemID}">${escapeHtml(i.Name)} (₹${Number(i.SellingRate).toFixed(2)})</option>`).join('');
        $('item-count').textContent = items.length;
    }

    async function refreshItemsFromCloud() {
        const btn = $('btn-refresh');
        try {
            btn.disabled = true; btn.textContent = 'Refreshing…';
            ensureConfigured();
            const fetched = await window.EpalaceFirestore.getItems();
            if (fetched.length) await window.EpalaceDB.saveItems(fetched);
            await loadItems();
            toast(`Refreshed ${fetched.length} item(s) from cloud.`, 'success');
        } catch (e) {
            toast('Could not refresh items: ' + e.message, 'danger');
        } finally {
            btn.disabled = false; btn.textContent = 'Refresh items from cloud';
        }
    }

    // ---- Lines ----
    function addLine() {
        const id = $('item-select').value;
        const qty = parseInt($('line-qty').value, 10);
        if (!id) { toast('Pick an item first.', 'warning'); return; }
        if (!qty || qty < 1) { toast('Enter a valid quantity.', 'warning'); return; }
        const item = items.find(i => String(i.ItemID) === String(id));
        if (!item) return;
        lines.push({
            ItemID: item.ItemID, ItemName: item.Name, Description: item.Description || '',
            SupplierRate: Number(item.SupplierRate) || 0, SellingRate: Number(item.SellingRate) || 0, Qty: qty
        });
        $('item-select').value = ''; $('line-qty').value = '1';
        renderLines();
    }

    function renderLines() {
        const body = $('lines-body');
        if (!lines.length) {
            body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No items added.</td></tr>';
        } else {
            body.innerHTML = lines.map((l, idx) =>
                `<tr>
                    <td>${escapeHtml(l.ItemName)}</td>
                    <td class="text-end">${l.Qty}</td>
                    <td class="text-end">${money(l.SellingRate)}</td>
                    <td class="text-end">${money(l.SellingRate * l.Qty)}</td>
                    <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" data-rm="${idx}">&times;</button></td>
                </tr>`).join('');
        }
        computeTotals();
    }

    function computeTotals() {
        const selling = lines.reduce((s, l) => s + l.SellingRate * l.Qty, 0);
        const discount = parseFloat($('f-discount').value) || 0;
        const taxPct = parseFloat($('f-tax').value) || 0;
        const delivery = parseFloat($('f-delivery').value) || 0;
        const paid = parseFloat($('f-paid').value) || 0;
        const taxable = Math.max(0, selling - discount);
        const tax = Math.round(taxable * taxPct) / 100;
        const grand = taxable + tax + delivery;
        $('t-selling').textContent = money(selling);
        $('t-tax').textContent = money(tax);
        $('t-grand').textContent = money(grand);
        $('t-balance').textContent = money(grand - paid);
    }

    // ---- Save / queue ----
    async function saveOrder() {
        const name = $('f-name').value.trim();
        const phone = $('f-phone').value.trim();
        if (!name) { toast('Customer name is required.', 'warning'); return; }
        if (!phone) { toast('Phone number is required.', 'warning'); return; }
        if (!lines.length) { toast('Add at least one item.', 'warning'); return; }

        const pm = PAYMENT_MODES.find(p => String(p.id) === $('f-paymode').value) || PAYMENT_MODES[0];
        const order = {
            Id: newId(),
            InvoiceNo: null,
            CustomerID: null,
            CustomerName: name,
            Address: $('f-address').value.trim() || '-',
            PhoneNumber: phone,
            CustomerEmail: $('f-email').value.trim() || null,
            PaymentModeID: pm.id,
            ModeOfPayment: pm.name,
            AmountPaid: parseFloat($('f-paid').value) || 0,
            Discount: parseFloat($('f-discount').value) || 0,
            TaxPercent: parseFloat($('f-tax').value) || 0,
            DeliveryCharges: parseFloat($('f-delivery').value) || 0,
            OrderStatus: 'Pending',
            Description: $('f-notes').value.trim() || null,
            CreatedAtUtc: new Date().toISOString(),
            DeviceId: deviceId(),
            Synced: false,
            Lines: lines.slice()
        };
        await window.EpalaceDB.enqueueOrder(order);
        resetForm();
        await updateQueueCount();
        toast('Order saved offline and queued for sync.', 'success');
        if (navigator.onLine && window.epalaceFirebaseConfigured()) pushQueue();
    }

    function resetForm() {
        ['f-name', 'f-phone', 'f-address', 'f-email', 'f-notes'].forEach(id => $(id).value = '');
        ['f-discount', 'f-tax', 'f-delivery', 'f-paid'].forEach(id => $(id).value = '0');
        lines = [];
        renderLines();
    }

    // ---- Push to cloud ----
    async function pushQueue() {
        const btn = $('btn-push');
        const queue = await window.EpalaceDB.getQueue();
        if (!queue.length) { toast('Nothing to push — queue is empty.', 'info'); return; }
        if (!navigator.onLine) { toast('You are offline — orders stay queued until you reconnect.', 'warning'); return; }
        try {
            btn.disabled = true; btn.textContent = 'Pushing…';
            ensureConfigured();
            let pushed = 0;
            for (const o of queue) {
                await window.EpalaceFirestore.pushOrder(o);
                await window.EpalaceDB.removeQueued(o.Id);
                pushed++;
            }
            await updateQueueCount();
            toast(`Pushed ${pushed} order(s) to the cloud. Use the web app's Sync button to import them.`, 'success');
        } catch (e) {
            toast('Push failed (orders remain queued): ' + e.message, 'danger');
        } finally {
            btn.disabled = false; btn.textContent = 'Push queued orders to cloud';
        }
    }

    function renderQueue(queue) {
        const body = $('queue-body');
        if (!queue.length) {
            body.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No queued orders.</td></tr>';
            return;
        }
        body.innerHTML = queue.map(o => {
            const total = o.Lines.reduce((s, l) => s + l.SellingRate * l.Qty, 0);
            return `<tr>
                <td>${escapeHtml(o.CustomerName)}<br><small class="text-muted">${escapeHtml(o.PhoneNumber)}</small></td>
                <td>${o.Lines.length} item(s)</td>
                <td class="text-end">${money(total)}</td>
                <td><small>${new Date(o.CreatedAtUtc).toLocaleString()}</small></td>
            </tr>`;
        }).join('');
    }

    // ---- utils ----
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    let toastTimer = null;
    function toast(msg, kind) {
        const el = $('toast');
        el.className = 'alert alert-' + (kind || 'info');
        el.textContent = msg;
        el.style.display = '';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
    }

    // ---- init ----
    function init() {
        $('f-paymode').innerHTML = PAYMENT_MODES.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        $('btn-add-line').addEventListener('click', addLine);
        $('btn-save').addEventListener('click', saveOrder);
        $('btn-refresh').addEventListener('click', refreshItemsFromCloud);
        $('btn-push').addEventListener('click', pushQueue);
        ['f-discount', 'f-tax', 'f-delivery', 'f-paid'].forEach(id => $(id).addEventListener('input', computeTotals));
        $('lines-body').addEventListener('click', e => {
            const rm = e.target.getAttribute('data-rm');
            if (rm !== null) { lines.splice(parseInt(rm, 10), 1); renderLines(); }
        });
        window.addEventListener('online', () => { setStatus(); if (window.epalaceFirebaseConfigured()) pushQueue(); });
        window.addEventListener('offline', setStatus);

        setStatus();
        loadItems();
        updateQueueCount();
        renderLines();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
