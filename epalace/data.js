// ---------------------------------------------------------------------------
// Authenticated Firestore CRUD over the REST API. Every request carries the
// signed-in user's ID token, so Firestore security rules can require auth.
// ---------------------------------------------------------------------------
window.EpalaceData = (function () {
    const FB = () => window.EpalaceFB;

    async function authHeaders(extra) {
        const token = await window.EpalaceAuth.getIdToken();
        return Object.assign({ 'Authorization': 'Bearer ' + token }, extra || {});
    }

    async function req(url, options) {
        const r = await fetch(url, options);
        const text = await r.text();
        let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
        if (!r.ok) {
            const msg = (body.error && body.error.message) || (`HTTP ${r.status}`);
            throw new Error(msg);
        }
        return body;
    }

    function docToObj(d) {
        const o = FB().fromFields(d.fields || {});
        o.id = d.name.split('/').pop();
        return o;
    }

    // List all docs in a collection (follows pagination).
    async function list(collection) {
        let url = `${FB().firestoreBase()}/${collection}?pageSize=300`;
        const out = [];
        for (let guard = 0; guard < 100; guard++) {
            const j = await req(url, { headers: await authHeaders() });
            (j.documents || []).forEach(d => out.push(docToObj(d)));
            if (!j.nextPageToken) break;
            url = `${FB().firestoreBase()}/${collection}?pageSize=300&pageToken=${encodeURIComponent(j.nextPageToken)}`;
        }
        return out;
    }

    async function get(collection, id) {
        const j = await req(`${FB().firestoreBase()}/${collection}/${encodeURIComponent(id)}`,
            { headers: await authHeaders() });
        return docToObj(j);
    }

    // Create with an auto-generated id, or a specific id when provided.
    async function create(collection, data, id) {
        const body = JSON.stringify({ fields: FB().toFields(data) });
        if (id) {
            const j = await req(`${FB().firestoreBase()}/${collection}/${encodeURIComponent(id)}`,
                { method: 'PATCH', headers: await authHeaders({ 'Content-Type': 'application/json' }), body });
            return docToObj(j);
        }
        const j = await req(`${FB().firestoreBase()}/${collection}`,
            { method: 'POST', headers: await authHeaders({ 'Content-Type': 'application/json' }), body });
        return docToObj(j);
    }

    // Update only the given fields (merge).
    async function update(collection, id, data) {
        const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        const body = JSON.stringify({ fields: FB().toFields(data) });
        const j = await req(`${FB().firestoreBase()}/${collection}/${encodeURIComponent(id)}?${mask}`,
            { method: 'PATCH', headers: await authHeaders({ 'Content-Type': 'application/json' }), body });
        return docToObj(j);
    }

    async function remove(collection, id) {
        await req(`${FB().firestoreBase()}/${collection}/${encodeURIComponent(id)}`,
            { method: 'DELETE', headers: await authHeaders() });
        return true;
    }

    return { list, get, create, update, remove };
})();
