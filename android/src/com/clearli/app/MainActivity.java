package com.clearli.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.Log;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Clearli host activity. The UI is a local (offline) web app in assets/www rendered in a
 * WebView that is blocked from ALL network access. Only this native layer talks to the
 * network, and only to the user's SimpleFIN access URL over HTTPS. All data at rest is
 * encrypted with an AES-256-GCM key held in the Android Keystore.
 */
public class MainActivity extends Activity {
    private static final String TAG = "Clearli";
    private static final int REQ_UNLOCK = 41;
    private static final int REQ_EXPORT = 42;
    private static final int REQ_IMPORT = 43;

    private WebView web;
    private SecureStore store;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Object saveLock = new Object();
    private String pendingSave = null;
    private final Map<String, String> results = new HashMap<String, String>();
    private final AtomicInteger seq = new AtomicInteger(1);
    private long pausedAt = 0;
    private boolean internalLaunch = false; // our own picker/unlock screens shouldn't re-trigger the app lock
    private boolean pageReady = false;

    private GoogleAuth gauth;
    private volatile boolean tabOpen = false; // a SimpleFIN / Google page is shown over the app
    private volatile String launchTarget; // e.g. "calendar" when opened from the home-screen widget
    private String pendingCb;
    private String pendingExportContent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        // Privacy: no screenshots, no content in the recent-apps thumbnail.
        w.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        w.setStatusBarColor(Color.parseColor("#0B0D1A"));
        w.setNavigationBarColor(Color.parseColor("#0B0D1A"));

        store = new SecureStore(this);
        gauth = new GoogleAuth(store);
        launchTarget = getIntent() != null ? getIntent().getStringExtra("open") : null;

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0D1A"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setBlockNetworkLoads(true);          // the UI can never reach the internet
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith("file:///android_asset/");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, "js: " + m.message() + " @" + m.lineNumber());
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String t = intent != null ? intent.getStringExtra("open") : null;
        if (t == null) return;
        if (pageReady) js("window.App && App.openFrom && App.openFrom(" + JSONObject.quote(t) + ")");
        else launchTarget = t;
    }

    @Override
    protected void onPause() {
        super.onPause();
        pausedAt = SystemClock.elapsedRealtime();
        js("window.App && App.onPause && App.onPause()");
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (tabOpen) { tabOpen = false; internalLaunch = false; pausedAt = 0; js("window.App && App.onTabClosed && App.onTabClosed()"); return; }
        if (internalLaunch) { internalLaunch = false; pausedAt = 0; return; }
        if (pausedAt > 0 && pageReady) {
            long away = SystemClock.elapsedRealtime() - pausedAt;
            js("window.App && App.onResume && App.onResume(" + away + ")");
        }
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.App && App.back) ? App.back() : false", new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"true".equals(v)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onDestroy() {
        io.shutdown();
        pool.shutdownNow();
        super.onDestroy();
    }

    private void showTab(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            Bundle extras = new Bundle();
            extras.putBinder("android.support.customtabs.extra.SESSION", null); // marks it as a Custom Tab (no library needed)
            i.putExtras(extras);
            i.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR", Color.parseColor("#0B0D1A"));
            i.putExtra("android.support.customtabs.extra.TITLE_VISIBILITY", 1);
            i.putExtra("androidx.browser.customtabs.extra.SHARE_STATE", 2);
            i.putExtra("android.support.customtabs.extra.ENABLE_URLBAR_HIDING", true);
            tabOpen = true;
            internalLaunch = true;
            startActivity(i);
        } catch (Exception e) {
            tabOpen = false;
            internalLaunch = false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
        }
    }

    private void js(final String code) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(code, null);
            }
        });
    }

    /** Result is parked natively; JS fetches it with Native.take(key) to avoid huge eval strings. */
    private void callback(String cbId, String payload) {
        String key = "r" + seq.getAndIncrement();
        synchronized (results) { results.put(key, payload); }
        js("window.__nativeCb && __nativeCb(" + JSONObject.quote(cbId) + "," + JSONObject.quote(key) + ")");
    }

    private static String err(String msg) {
        try {
            JSONObject o = new JSONObject();
            o.put("ok", false);
            o.put("error", msg);
            return o.toString();
        } catch (Exception e) {
            return "{\"ok\":false}";
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        String cb = pendingCb;
        pendingCb = null;
        if (cb == null) return;
        try {
            if (requestCode == REQ_UNLOCK) {
                callback(cb, resultCode == RESULT_OK ? "{\"ok\":true}" : err("cancelled"));
            } else if (requestCode == REQ_EXPORT) {
                if (resultCode != RESULT_OK || data == null || data.getData() == null) { callback(cb, err("cancelled")); return; }
                OutputStream os = getContentResolver().openOutputStream(data.getData(), "wt");
                os.write(pendingExportContent.getBytes("UTF-8"));
                os.close();
                pendingExportContent = null;
                callback(cb, "{\"ok\":true}");
            } else if (requestCode == REQ_IMPORT) {
                if (resultCode != RESULT_OK || data == null || data.getData() == null) { callback(cb, err("cancelled")); return; }
                InputStream is = getContentResolver().openInputStream(data.getData());
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                is.close();
                JSONObject o = new JSONObject();
                o.put("ok", true);
                o.put("content", bo.toString("UTF-8"));
                callback(cb, o.toString());
            }
        } catch (Exception e) {
            callback(cb, err(e.getMessage()));
        }
    }

    /** Everything the web UI can ask the device to do. */
    public class Bridge {
        @JavascriptInterface
        public String take(String key) {
            synchronized (results) { return results.remove(key); }
        }

        @JavascriptInterface
        public String loadData() {
            synchronized (saveLock) { if (pendingSave != null) return pendingSave; }
            try { return store.read("data"); } catch (Exception e) { Log.e(TAG, "load", e); return null; }
        }

        /** Encrypt + write off the UI/JS thread so edits never stutter. Writes are serialized and coalesced. */
        @JavascriptInterface
        public boolean saveData(String json) {
            synchronized (saveLock) { pendingSave = json; }
            io.execute(new Runnable() {
                @Override
                public void run() {
                    String j;
                    synchronized (saveLock) { j = pendingSave; pendingSave = null; }
                    if (j == null) return;
                    try { store.write("data", j); } catch (Exception e) { Log.e(TAG, "save", e); }
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean hasCredential() {
            try { return store.read("cred") != null; } catch (Exception e) { return false; }
        }

        @JavascriptInterface
        public void clearCredential() { store.delete("cred"); }

        /** Snapshot for the home-screen widget (encrypted like everything else). */
        @JavascriptInterface
        public void widgetData(final String json) {
            io.execute(new Runnable() {
                @Override
                public void run() {
                    try { store.write("widget", json); CalWidget.refresh(getApplicationContext()); } catch (Exception e) { Log.e(TAG, "widget", e); }
                }
            });
        }

        /** Shows a web page over the app (Chrome Custom Tab) so people never feel they left Clearli. */
        @JavascriptInterface
        public void openTab(final String url) {
            if (url == null || !url.startsWith("https://")) return;
            ui.post(new Runnable() {
                @Override
                public void run() { showTab(url); }
            });
        }

        /** Google sign-in for Drive sync (stays signed in; see GoogleAuth). */
        @JavascriptInterface
        public void googleSignIn(final String clientId, final String secret, final String hint, final String cbId) {
            final String url;
            try { url = gauth.begin(clientId, secret, hint); } catch (Exception e) { callback(cbId, err(e.getMessage())); return; }
            ui.post(new Runnable() {
                @Override
                public void run() { showTab(url); }
            });
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        String code = gauth.awaitCode();
                        JSONObject r = gauth.exchange(code);
                        ui.post(new Runnable() {
                            @Override
                            public void run() {
                                try { startActivity(new Intent(MainActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP)); } catch (Exception ignored) { }
                            }
                        });
                        callback(cbId, r.toString());
                    } catch (Exception e) {
                        callback(cbId, err(e.getMessage() == null ? "Sign-in failed" : e.getMessage()));
                    }
                }
            }).start();
        }

        @JavascriptInterface
        public void googleCancel() { gauth.cancel(); }

        @JavascriptInterface
        public void googleToken(final String force, final String cbId) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    try { callback(cbId, gauth.token("1".equals(force) || "true".equals(force)).toString()); }
                    catch (Exception e) { callback(cbId, err("Couldn't reach Google: " + e.getMessage())); }
                }
            });
        }

        @JavascriptInterface
        public boolean hasGoogle() { return gauth.signedIn(); }

        @JavascriptInterface
        public void googleSignOut() { gauth.signOut(); }

        @JavascriptInterface
        public String takeLaunch() { String t = launchTarget; launchTarget = null; return t; }

        @JavascriptInterface
        public void wipeAll() {
            store.delete("cred");
            store.delete("data");
            store.delete("widget");
            gauth.signOut();
            try { CalWidget.refresh(getApplicationContext()); } catch (Exception ignored) { }
            store.deleteKey();
        }

        @JavascriptInterface
        public void claimToken(final String token, final String cbId) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        String access = SimpleFin.claim(token);
                        store.write("cred", access);
                        JSONObject o = new JSONObject();
                        o.put("ok", true);
                        o.put("host", Uri.parse(access).getHost());
                        callback(cbId, o.toString());
                    } catch (Exception e) {
                        callback(cbId, err(e.getMessage()));
                    }
                }
            });
        }

        @JavascriptInterface
        public void fetchAccounts(final String startSec, final String endSec, final boolean balancesOnly, final String cbId) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        String access = store.read("cred");
                        if (access == null) { callback(cbId, err("not_connected")); return; }
                        SimpleFin.Resp r = SimpleFin.accounts(access, startSec, endSec, balancesOnly);
                        JSONObject o = new JSONObject();
                        o.put("ok", r.status == 200);
                        o.put("status", r.status);
                        o.put("body", r.body);
                        if (r.status == 403) o.put("error", "Access was revoked or is invalid (403). Reconnect with a new setup token.");
                        else if (r.status == 402) o.put("error", "SimpleFIN subscription payment required (402).");
                        else if (r.status != 200) o.put("error", "SimpleFIN returned HTTP " + r.status);
                        callback(cbId, o.toString());
                    } catch (Exception e) {
                        callback(cbId, err(e.getMessage()));
                    }
                }
            });
        }

        /** HTTPS for encrypted cloud sync. Only Google's Firebase Auth / Firestore hosts are allowed. */
        @JavascriptInterface
        public void https(final String method, final String url, final String headersJson, final String body, final String cbId) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    try {
                        java.net.URL u = new java.net.URL(url);
                        String h = u.getHost();
                        if (!"https".equals(u.getProtocol()) || !("identitytoolkit.googleapis.com".equals(h) || "securetoken.googleapis.com".equals(h) || "firestore.googleapis.com".equals(h) || "www.googleapis.com".equals(h))) {
                            callback(cbId, err("Host not allowed"));
                            return;
                        }
                        java.net.HttpURLConnection c = (java.net.HttpURLConnection) u.openConnection();
                        c.setConnectTimeout(20000);
                        c.setReadTimeout(60000);
                        c.setUseCaches(false);
                        c.setInstanceFollowRedirects(false);
                        // HttpURLConnection has no PATCH; Google APIs accept the override header
                        if ("PATCH".equals(method)) { c.setRequestMethod("POST"); c.setRequestProperty("X-HTTP-Method-Override", "PATCH"); }
                        else c.setRequestMethod(method);
                        JSONObject hs = new JSONObject(headersJson == null || headersJson.length() == 0 ? "{}" : headersJson);
                        java.util.Iterator<String> it = hs.keys();
                        while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, hs.getString(k)); }
                        if (body != null && body.length() > 0) {
                            byte[] b = body.getBytes("UTF-8");
                            c.setDoOutput(true);
                            c.setFixedLengthStreamingMode(b.length);
                            OutputStream os = c.getOutputStream();
                            os.write(b);
                            os.close();
                        }
                        int code = c.getResponseCode();
                        InputStream is = code < 400 ? c.getInputStream() : c.getErrorStream();
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        if (is != null) { byte[] buf = new byte[16384]; int n; while ((n = is.read(buf)) > 0) bo.write(buf, 0, n); is.close(); }
                        c.disconnect();
                        JSONObject o = new JSONObject();
                        o.put("ok", code >= 200 && code < 300);
                        o.put("status", code);
                        o.put("body", bo.toString("UTF-8"));
                        callback(cbId, o.toString());
                    } catch (Exception e) {
                        callback(cbId, err("Network error: " + e.getMessage()));
                    }
                }
            });
        }

        @JavascriptInterface
        public String accessHost() {
            try {
                String a = store.read("cred");
                return a == null ? null : Uri.parse(a).getHost();
            } catch (Exception e) { return null; }
        }

        @JavascriptInterface
        public boolean isDeviceSecure() {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            return km != null && km.isDeviceSecure();
        }

        @JavascriptInterface
        public void requestUnlock(final String cbId) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                    Intent i = km == null ? null : km.createConfirmDeviceCredentialIntent("Unlock Clearli", "Confirm it's you to view your finances");
                    if (i == null) { callback(cbId, "{\"ok\":true,\"noLock\":true}"); return; }
                    pendingCb = cbId;
                    internalLaunch = true;
                    startActivityForResult(i, REQ_UNLOCK);
                }
            });
        }

        @JavascriptInterface
        public void setBars(final String hex, final boolean lightIcons) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        int c = Color.parseColor(hex);
                        getWindow().setStatusBarColor(c);
                        getWindow().setNavigationBarColor(c);
                        web.setBackgroundColor(c);
                        View d = getWindow().getDecorView();
                        int f = d.getSystemUiVisibility();
                        if (lightIcons) f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        else f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        d.setSystemUiVisibility(f);
                    } catch (Exception ignored) { }
                }
            });
        }

        @JavascriptInterface
        public void setSecure(final boolean on) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
            });
        }

        @JavascriptInterface
        public void haptic() {
            ui.post(new Runnable() {
                @Override
                public void run() { web.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); }
            });
        }

        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || !url.startsWith("https://")) return;
            ui.post(new Runnable() {
                @Override
                public void run() {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
                }
            });
        }

        @JavascriptInterface
        public void exportFile(final String name, final String mime, final String content, final String cbId) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_TITLE, name);
                    pendingCb = cbId;
                    pendingExportContent = content;
                    try { internalLaunch = true; startActivityForResult(i, REQ_EXPORT); } catch (Exception e) { pendingCb = null; callback(cbId, err("No file picker available")); }
                }
            });
        }

        @JavascriptInterface
        public void importFile(final String cbId) {
            ui.post(new Runnable() {
                @Override
                public void run() {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    pendingCb = cbId;
                    try { internalLaunch = true; startActivityForResult(i, REQ_IMPORT); } catch (Exception e) { pendingCb = null; callback(cbId, err("No file picker available")); }
                }
            });
        }

        @JavascriptInterface
        public String clipboard() {
            try {
                android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm == null || !cm.hasPrimaryClip() || cm.getPrimaryClip().getItemCount() == 0) return "";
                CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
                return t == null ? "" : t.toString();
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public String version() { return BuildInfo.VERSION + " (Android " + Build.VERSION.RELEASE + ")"; }

        @JavascriptInterface
        public String decodeToken(String t) {
            try { return SimpleFin.decodeToken(t); } catch (Exception e) { return null; }
        }
    }
}
