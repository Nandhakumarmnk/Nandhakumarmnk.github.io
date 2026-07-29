// ---------------------------------------------------------------------------
// Firebase Authentication via the Identity Toolkit REST API (email/password).
// Stores the session in localStorage and auto-refreshes the ID token.
// ---------------------------------------------------------------------------
window.EpalaceAuth = (function () {
    const KEY = 'epalace-auth';

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
    }
    function save(session) { localStorage.setItem(KEY, JSON.stringify(session)); }
    function clear() { localStorage.removeItem(KEY); }

    async function signIn(email, password) {
        const key = window.EpalaceFB.apiKey();
        const r = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, returnSecureToken: true })
            });
        const j = await r.json();
        if (!r.ok) {
            const code = (j.error && j.error.message) || 'SIGN_IN_FAILED';
            throw new Error(friendly(code));
        }
        save({
            idToken: j.idToken,
            refreshToken: j.refreshToken,
            uid: j.localId,
            email: j.email,
            expiresAt: Date.now() + (parseInt(j.expiresIn, 10) * 1000)
        });
        return { uid: j.localId, email: j.email };
    }

    async function refresh() {
        const s = load();
        if (!s || !s.refreshToken) throw new Error('Not signed in.');
        const key = window.EpalaceFB.apiKey();
        const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`
        });
        const j = await r.json();
        if (!r.ok) { clear(); throw new Error('Session expired — please sign in again.'); }
        s.idToken = j.id_token;
        s.refreshToken = j.refresh_token;
        s.expiresAt = Date.now() + (parseInt(j.expires_in, 10) * 1000);
        save(s);
        return s.idToken;
    }

    // Returns a valid ID token, refreshing if it's within 2 min of expiry.
    async function getIdToken() {
        const s = load();
        if (!s) throw new Error('Not signed in.');
        if (Date.now() > (s.expiresAt - 120000)) return await refresh();
        return s.idToken;
    }

    function currentUser() {
        const s = load();
        return s ? { uid: s.uid, email: s.email } : null;
    }
    function isLoggedIn() { return !!load(); }
    function signOut() { clear(); }

    function friendly(code) {
        if (code.startsWith('EMAIL_NOT_FOUND') || code.startsWith('INVALID_PASSWORD') || code.startsWith('INVALID_LOGIN_CREDENTIALS'))
            return 'Wrong email or password.';
        if (code.startsWith('USER_DISABLED')) return 'This account has been disabled.';
        if (code.startsWith('TOO_MANY_ATTEMPTS')) return 'Too many attempts — try again later.';
        if (code.startsWith('CONFIGURATION_NOT_FOUND') || code.startsWith('OPERATION_NOT_ALLOWED'))
            return 'Email/password sign-in is not enabled in Firebase yet.';
        return code;
    }

    return { signIn, signOut, getIdToken, currentUser, isLoggedIn };
})();
