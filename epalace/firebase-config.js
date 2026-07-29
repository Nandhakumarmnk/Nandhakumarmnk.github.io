// ---------------------------------------------------------------------------
// Firebase web config for the OFFLINE ORDER ENTRY page (client side).
//
//   >>> REPLACE the values below with YOUR project's web config. <<<
//   Get them from: Firebase Console ▸ Project settings ▸ General ▸ Your apps ▸ Web
//   (see OFFLINE_SYNC_SETUP.md section 3a).
//
// These values are NOT secret — Firebase web config is meant to ship in the client.
// Security is enforced by Firestore rules, not by hiding this.
//
// Collection names MUST match the web app's Firebase:ItemsCollection /
// Firebase:OrdersCollection settings (defaults: "items" / "orders").
// ---------------------------------------------------------------------------
window.EPALACE_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCIjUD7SdGIiFlBMwis4FOBEGI5Db0gXPE",
    authDomain: "epalce.firebaseapp.com",
    projectId: "epalce",
    storageBucket: "epalce.firebasestorage.app",
    messagingSenderId: "828012989560",
    appId: "1:828012989560:web:3f48fae271a918f9bd718d",
    measurementId: "G-BT4P85CYHD"
};

window.EPALACE_FIREBASE_COLLECTIONS = { items: "items", orders: "orders" };

// Firebase modular SDK version loaded on demand (only when online, only for cloud push/refresh).
window.EPALACE_FIREBASE_SDK_VERSION = "10.12.2";

window.epalaceFirebaseConfigured = function () {
    var c = window.EPALACE_FIREBASE_CONFIG;
    return c && c.projectId && c.projectId !== "REPLACE_ME" && c.apiKey && c.apiKey !== "REPLACE_ME";
};
