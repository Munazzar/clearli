package com.clearli.app;

import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;

/** Minimal SimpleFIN protocol client (https://www.simplefin.org/protocol.html). HTTPS only. */
final class SimpleFin {
    private SimpleFin() { }

    static final class Resp {
        int status;
        String body;
    }

    static String decodeToken(String token) throws Exception {
        String t = token.trim().replaceAll("\\s", "").replace('-', '+').replace('_', '/');
        while (t.length() % 4 != 0) t += "=";
        String url = new String(Base64.decode(t, Base64.DEFAULT), "UTF-8").trim();
        if (!url.startsWith("https://")) throw new Exception("That doesn't look like a SimpleFIN setup token.");
        return url;
    }

    /** POST to the claim URL; response body is the Access URL (https://user:pass@host/path). */
    static String claim(String token) throws Exception {
        String claimUrl = decodeToken(token);
        HttpURLConnection c = open(new URL(claimUrl));
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setFixedLengthStreamingMode(0);
        OutputStream os = c.getOutputStream();
        os.close();
        int code = c.getResponseCode();
        String body = read(code < 400 ? c.getInputStream() : c.getErrorStream());
        c.disconnect();
        if (code == 403) throw new Exception("This setup token was already used or is invalid. Create a new token in SimpleFIN Bridge and try again.");
        if (code != 200) throw new Exception("Claim failed (HTTP " + code + ").");
        String access = body.trim();
        if (!access.startsWith("https://") || !access.contains("@")) throw new Exception("Unexpected response from SimpleFIN while claiming the token.");
        return access;
    }

    static Resp accounts(String accessUrl, String start, String end, boolean balancesOnly) throws Exception {
        URL a = new URL(accessUrl);
        if (!"https".equals(a.getProtocol())) throw new Exception("Refusing non-HTTPS access URL");
        String userInfo = a.getUserInfo();
        String base = "https://" + a.getHost() + (a.getPort() > 0 ? ":" + a.getPort() : "") + a.getPath();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        StringBuilder q = new StringBuilder(base).append("/accounts?version=2&pending=1");
        if (start != null && start.length() > 0) q.append("&start-date=").append(start);
        if (end != null && end.length() > 0) q.append("&end-date=").append(end);
        if (balancesOnly) q.append("&balances-only=1");
        HttpURLConnection c = open(new URL(q.toString()));
        if (userInfo != null) {
            int i = userInfo.indexOf(':');
            String u = URLDecoder.decode(i >= 0 ? userInfo.substring(0, i) : userInfo, "UTF-8");
            String p = i >= 0 ? URLDecoder.decode(userInfo.substring(i + 1), "UTF-8") : "";
            String basic = Base64.encodeToString((u + ":" + p).getBytes("UTF-8"), Base64.NO_WRAP);
            c.setRequestProperty("Authorization", "Basic " + basic);
        }
        Resp r = new Resp();
        r.status = c.getResponseCode();
        r.body = read(r.status < 400 ? c.getInputStream() : c.getErrorStream());
        c.disconnect();
        return r;
    }

    private static HttpURLConnection open(URL u) throws Exception {
        if (!"https".equals(u.getProtocol())) throw new Exception("Only HTTPS is allowed");
        HttpURLConnection c = (HttpURLConnection) u.openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(90000);
        c.setUseCaches(false);
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("User-Agent", "Clearli/" + BuildInfo.VERSION);
        return c;
    }

    private static String read(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
        is.close();
        return bo.toString("UTF-8");
    }
}
