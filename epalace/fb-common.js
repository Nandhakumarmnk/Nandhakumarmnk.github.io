// ---------------------------------------------------------------------------
// Shared Firebase helpers for the E-Palace client app.
// Uses the Firestore REST API (not the JS SDK) — reliable on restrictive
// networks where the SDK's WebChannel transport is blocked.
// ---------------------------------------------------------------------------
window.EpalaceFB = (function () {
    function cfg() { return window.EPALACE_FIREBASE_CONFIG || {}; }
    function projectId() { return cfg().projectId; }
    function apiKey() { return cfg().apiKey; }
    function firestoreBase() {
        return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
    }

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
        for (const k in (fields || {})) o[k] = fromValue(fields[k]);
        return o;
    }

    return { cfg, projectId, apiKey, firestoreBase, toValue, toFields, fromValue, fromFields };
})();
