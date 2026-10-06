package com.clearli.app;

import android.util.Base64;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Google sign-in for Drive sync that stays signed in: OAuth 2.0 authorization code + PKCE with a
 * loopback redirect (Google's "Desktop app" client type). The browser hands the code to a one-shot
 * listener on 127.0.0.1, we exchange it for a refresh token and keep that encrypted in SecureStore.
 * Access tokens (1 hour) are then renewed silently — no sign-in prompts after the first time.
 * The web UI never sees the refresh token, only short-lived access tokens.
 */
final class GoogleAuth {
    static final String SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private static final String KEY = "google";
    private final SecureStore store;
    private String access;
    private long exp;
    private ServerSocket server;
    private String verifier, state, redirect, clientId, secret;

    GoogleAuth(SecureStore s) { store = s; }

    private static String rnd(int n) {
        byte[] b = new byte[n];
        new SecureRandom().nextBytes(b);
        return Base64.encodeToString(b, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    private static String enc(String s) throws Exception { return URLEncoder.encode(s, "UTF-8"); }

    /** Opens the one-shot listener and returns the Google sign-in URL to show in the browser. */
    synchronized String begin(String cid, String sec, String hint) throws Exception {
        cancel();
        clientId = cid;
        secret = sec;
        server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
        server.setSoTimeout(10 * 60 * 1000);
        redirect = "http://127.0.0.1:" + server.getLocalPort();
        verifier = rnd(48);
        state = rnd(16);
        byte[] h = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes("US-ASCII"));
        String challenge = Base64.encodeToString(h, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        return "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + enc(cid) + "&redirect_uri=" + enc(redirect)
                + "&response_type=code&scope=" + enc(SCOPE) + "&code_challenge=" + challenge + "&code_challenge_method=S256"
                + "&access_type=offline&prompt=" + enc("select_account consent") + "&state=" + state
                + (hint != null && hint.length() > 0 ? "&login_hint=" + enc(hint) : "");
    }

    synchronized void cancel() {
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        server = null;
    }

    /** Waits for the browser to come back with ?code=…, answers it with a small page, returns the code. */
    String awaitCode() throws Exception {
        ServerSocket ss;
        synchronized (this) { ss = server; }
        if (ss == null) throw new Exception("cancelled");
        try {
            while (true) {
                Socket s = ss.accept();
                try {
                    InputStream in = s.getInputStream();
                    StringBuilder line = new StringBuilder();
                    int c;
                    while ((c = in.read()) != -1 && c != '\n') line.append((char) c);
                    String l = line.toString().trim(); // GET /?state=..&code=.. HTTP/1.1
                    String path = l.split(" ").length > 1 ? l.split(" ")[1] : "";
                    if (!path.startsWith("/?")) { reply(s, 404, "Not found"); continue; }
                    String code = null, st = null, error = null;
                    for (String kv : path.substring(2).split("&")) {
                        int i = kv.indexOf('=');
                        if (i < 0) continue;
                        String k = kv.substring(0, i), v = URLDecoder.decode(kv.substring(i + 1), "UTF-8");
                        if ("code".equals(k)) code = v; else if ("state".equals(k)) st = v; else if ("error".equals(k)) error = v;
                    }
                    if (st == null || !st.equals(state)) { reply(s, 400, "This sign-in link has expired. Go back to Clearli and try again."); continue; }
                    if (error != null || code == null) {
                        reply(s, 200, "Sign-in was cancelled. You can go back to Clearli.");
                        throw new Exception(error != null && error.contains("access_denied") ? "cancelled" : "Google sign-in failed: " + error);
                    }
                    reply(s, 200, "Signed in. Returning to Clearli…");
                    return code;
                } finally {
                    try { s.close(); } catch (Exception ignored) { }
                }
            }
        } finally {
            cancel();
        }
    }

    private static void reply(Socket s, int status, String msg) throws Exception {
        String html = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><title>Clearli</title>"
                + "<body style='font-family:sans-serif;background:#0B0D1A;color:#E6E9FA;display:flex;align-items:center;justify-content:center;height:90vh;text-align:center'>"
                + "<div><div style='font-size:42px'>✓</div><h2>" + msg + "</h2>"
                + "<p><a id=b href='intent://auth#Intent;scheme=clearli;package=com.clearli.app;end' style='display:inline-block;margin-top:12px;padding:14px 26px;border-radius:24px;background:#7C8CFF;color:#fff;text-decoration:none;font-weight:600'>Return to Clearli</a></p>"
                + "<p style='color:#99A3C7'>or close this page</p></div><script>setTimeout(function(){location.href=document.getElementById('b').href},300)</script>";
        byte[] b = html.getBytes("UTF-8");
        OutputStream o = s.getOutputStream();
        o.write(("HTTP/1.1 " + status + " OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + b.length + "\r\nConnection: close\r\n\r\n").getBytes("UTF-8"));
        o.write(b);
        o.flush();
    }

    private static JSONObject post(String form) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL("https://oauth2.googleapis.com/token").openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(30000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        byte[] b = form.getBytes("UTF-8");
        c.setFixedLengthStreamingMode(b.length);
        OutputStream os = c.getOutputStream();
        os.write(b);
        os.close();
        int code = c.getResponseCode();
        InputStream is = code < 400 ? c.getInputStream() : c.getErrorStream();
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        if (is != null) { byte[] buf = new byte[8192]; int n; while ((n = is.read(buf)) > 0) bo.write(buf, 0, n); is.close(); }
        JSONObject o = new JSONObject(bo.size() > 0 ? bo.toString("UTF-8") : "{}");
        o.put("_status", code);
        return o;
    }

    /** Code → refresh token (stored encrypted) + first access token. */
    synchronized JSONObject exchange(String code) throws Exception {
        JSONObject o = post("code=" + enc(code) + "&client_id=" + enc(clientId) + "&client_secret=" + enc(secret)
                + "&redirect_uri=" + enc(redirect) + "&grant_type=authorization_code&code_verifier=" + enc(verifier));
        if (o.optInt("_status") != 200 || !o.has("access_token")) throw new Exception("Google sign-in failed: " + o.optString("error_description", o.optString("error", "HTTP " + o.optInt("_status"))));
        String rt = o.optString("refresh_token", "");
        if (rt.length() == 0) throw new Exception("Google didn't return a long-lived sign-in. Remove Clearli under myaccount.google.com → Security → Third-party access, then try again.");
        JSONObject saved = new JSONObject();
        saved.put("rt", rt);
        saved.put("cid", clientId);
        saved.put("sec", secret);
        store.write(KEY, saved.toString());
        access = o.getString("access_token");
        exp = System.currentTimeMillis() + o.optLong("expires_in", 3600) * 1000;
        return result();
    }

    private JSONObject result() throws Exception {
        JSONObject r = new JSONObject();
        r.put("ok", true);
        r.put("token", access);
        r.put("exp", exp);
        return r;
    }

    boolean signedIn() {
        try { return store.read(KEY) != null; } catch (Exception e) { return false; }
    }

    /** A valid access token, renewed silently from the refresh token when needed. */
    synchronized JSONObject token(boolean force) throws Exception {
        if (!force && access != null && System.currentTimeMillis() < exp - 90000) return result();
        String s = store.read(KEY);
        if (s == null) {
            JSONObject r = new JSONObject();
            r.put("ok", false); r.put("signin", true); r.put("error", "Sign in with Google to sync");
            return r;
        }
        JSONObject saved = new JSONObject(s);
        JSONObject o = post("refresh_token=" + enc(saved.getString("rt")) + "&client_id=" + enc(saved.getString("cid"))
                + "&client_secret=" + enc(saved.optString("sec")) + "&grant_type=refresh_token");
        if (o.optInt("_status") == 200 && o.has("access_token")) {
            access = o.getString("access_token");
            exp = System.currentTimeMillis() + o.optLong("expires_in", 3600) * 1000;
            return result();
        }
        JSONObject r = new JSONObject();
        r.put("ok", false);
        String e = o.optString("error", "");
        if ("invalid_grant".equals(e) || "unauthorized_client".equals(e) || "invalid_client".equals(e)) {
            store.delete(KEY);
            access = null;
            r.put("signin", true);
            r.put("error", "Google sign-in was removed — sign in again");
        } else r.put("error", "Couldn't reach Google (" + (e.length() > 0 ? e : "HTTP " + o.optInt("_status")) + ")");
        return r;
    }

    synchronized void signOut() {
        try {
            String s = store.read(KEY);
            if (s != null) {
                final String rt = new JSONObject(s).optString("rt");
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            HttpURLConnection c = (HttpURLConnection) new URL("https://oauth2.googleapis.com/revoke?token=" + enc(rt)).openConnection();
                            c.setRequestMethod("POST");
                            c.setConnectTimeout(10000);
                            c.getResponseCode();
                        } catch (Exception ignored) { }
                    }
                }).start();
            }
        } catch (Exception ignored) { }
        store.delete(KEY);
        access = null;
        exp = 0;
    }
}
