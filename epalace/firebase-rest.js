// ---------------------------------------------------------------------------
// Firestore access for the offline page via the REST API (not the JS SDK).
//
// Why REST instead of the Firebase SDK?
//   • The SDK's WebChannel/gRPC-web transport is blocked on many restrictive
//     networks (corporate proxies, some mobile carriers) — exactly the flaky
//     connectivity this offline app targets. Plain HTTPS fetch (REST) gets
//     through far more reliably.
//   • No large SDK download from a CDN — lighter and works even when the CDN is slow.
//
// Security: uses the public web API key; access is governed entirely by the
// Firestore security rules (read items / write orders). The service-account key
// stays on the server and is never used here.
// ---------------------------------------------------------------------------
window.EpalaceFirestore = (function () {
    function cfg() { return window.EPALACE_FIREBASE_CONFIG || {}; }
    function base() {
        return `https://firestore.googleapis.com/v1/projects/${cfg().projectId}/databases/(default)/documents`;
    }
    function key() { return cfg().apiKey; }

    // ---- Firestore REST <-> plain JS value conversion ----
    function toValue(v) {
        if (v === null || v === undefined) return { nullValue: null };
        if (typeof v === 'boolean') return { booleanValue: v };
        if (typeof v === 'number')
            return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        if (v instanceof Date) return { timestampValue: v.toISOString() };
        if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
        if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
        return { stringValue: String(v) };
    }
    function toFields(obj) {
        const f = {};
        for (const k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) f[k] = toValue(obj[k]);
        return f;
    }
    function fromValue(val) {
        if (!val || typeof val !== 'object') return null;
        if ('nullValue' in val) return null;
        if ('booleanValue' in val) return val.booleanValue;
        if ('integerValue' in val) return parseInt(val.integerValue, 10);
        if ('doubleValue' in val) return val.doubleValue;
        if ('timestampValue' in val) return val.timestampValue;
        if ('stringValue' in val) return val.stringValue;
        if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromValue);
        if ('mapValue' in val) return fromFields(val.mapValue.fields || {});
        return null;
    }
    function fromFields(fields) {
        const o = {};
        for (const k in fields) o[k] = fromValue(fields[k]);
        return o;
    }

    // ---- API ----
    // Read all documents in the items collection (follows pagination).
    async function getItems() {
        const coll = (window.EPALACE_FIREBASE_COLLECTIONS || {}).items || 'items';
        let url = `${base()}/${coll}?key=${key()}&pageSize=300`;
        const items = [];
        // Loop over pages so large catalogues aren't silently truncated.
        for (let guard = 0; guard < 50; guard++) {
            const r = await fetch(url);
            if (!r.ok) throw new Error(`Firestore read failed (${r.status}): ${(await r.text()).slice(0, 160)}`);
            const j = await r.json();
            (j.documents || []).forEach(d => {
                const o = fromFields(d.fields || {});
                o.ItemID = o.ItemID != null ? o.ItemID : d.name.split('/').pop();
                items.push(o);
            });
            if (!j.nextPageToken) break;
            url = `${base()}/${coll}?key=${key()}&pageSize=300&pageToken=${encodeURIComponent(j.nextPageToken)}`;
        }
        return items;
    }

    // Create/overwrite one order document at orders/{order.Id}.
    async function pushOrder(order) {
        const coll = (window.EPALACE_FIREBASE_COLLECTIONS || {}).orders || 'orders';
        const payload = Object.assign({}, order);
        const id = payload.Id;
        delete payload.Id;
        payload.CreatedAtUtc = new Date(order.CreatedAtUtc); // -> Firestore timestamp -> .NET DateTime
        payload.Synced = false;
        const url = `${base()}/${coll}/${encodeURIComponent(id)}?key=${key()}`;
        const r = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: toFields(payload) })
        });
        if (!r.ok) throw new Error(`Firestore write failed (${r.status}): ${(await r.text()).slice(0, 160)}`);
        return true;
    }

    return { getItems, pushOrder };
})();
