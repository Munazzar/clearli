package com.clearli.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Currency;
import java.util.HashMap;
import java.util.Locale;

/**
 * Home-screen widget: this month's bill calendar + what's coming up.
 * Amounts are masked by default; the eye button reveals them for one minute, then they hide again.
 * Data is a small snapshot the app writes (encrypted with the same Keystore key as everything else).
 */
public class CalWidget extends AppWidgetProvider {
    static final String A_TOGGLE = "com.clearli.app.W_TOGGLE";
    static final String A_REMASK = "com.clearli.app.W_REMASK";
    static final String A_PREV = "com.clearli.app.W_PREV";
    static final String A_NEXT = "com.clearli.app.W_NEXT";
    static final String A_TODAY = "com.clearli.app.W_TODAY";
    static final long REVEAL_MS = 60000;
    private static final String[] DOW = {"S", "M", "T", "W", "T", "F", "S"};
    private static final String[] MON = {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"};
    private static final String[] SDOW = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
    private static final String[] SMON = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};

    /** Called by the app whenever its data changes. */
    static void refresh(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, CalWidget.class));
        for (int id : ids) render(ctx, m, id);
    }

    private static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences("widget", Context.MODE_PRIVATE); }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        // periodic tick: keep "today" right and never leave amounts revealed
        if (prefs(ctx).getLong("reveal", 0) < System.currentTimeMillis()) prefs(ctx).edit().putLong("reveal", 0).apply();
        for (int id : ids) render(ctx, m, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle o) { render(ctx, m, id); }

    @Override
    public void onReceive(Context ctx, Intent in) {
        super.onReceive(ctx, in);
        String a = in.getAction();
        if (a == null) return;
        SharedPreferences p = prefs(ctx);
        long now = System.currentTimeMillis();
        if (A_TOGGLE.equals(a)) {
            boolean shown = p.getLong("reveal", 0) > now;
            long until = shown ? 0 : now + REVEAL_MS;
            p.edit().putLong("reveal", until).apply();
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = broadcast(ctx, A_REMASK);
            if (until > 0) am.set(AlarmManager.RTC, until + 500, pi); else am.cancel(pi);
        } else if (A_REMASK.equals(a)) {
            p.edit().putLong("reveal", 0).apply();
        } else if (A_PREV.equals(a)) {
            p.edit().putInt("off", Math.max(-1, p.getInt("off", 0) - 1)).apply();
        } else if (A_NEXT.equals(a)) {
            p.edit().putInt("off", Math.min(2, p.getInt("off", 0) + 1)).apply();
        } else if (A_TODAY.equals(a)) {
            p.edit().putInt("off", 0).apply();
        } else return;
        refresh(ctx);
    }

    private static PendingIntent broadcast(Context ctx, String action) {
        Intent i = new Intent(ctx, CalWidget.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, action.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class).setAction("com.clearli.app.OPEN_CALENDAR").putExtra("open", "calendar")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String key(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static int id(Context ctx, String name) { return ctx.getResources().getIdentifier(name, "id", ctx.getPackageName()); }

    static void render(Context ctx, AppWidgetManager m, int wid) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.cal_widget);
        SharedPreferences p = prefs(ctx);
        boolean reveal = p.getLong("reveal", 0) > System.currentTimeMillis();
        int off = p.getInt("off", 0);

        JSONObject snap = null;
        try { String s = new SecureStore(ctx).read("widget"); if (s != null) snap = new JSONObject(s); } catch (Exception ignored) { }

        v.setOnClickPendingIntent(R.id.eye, broadcast(ctx, A_TOGGLE));
        v.setOnClickPendingIntent(R.id.prev, broadcast(ctx, A_PREV));
        v.setOnClickPendingIntent(R.id.next, broadcast(ctx, A_NEXT));
        v.setOnClickPendingIntent(R.id.title, broadcast(ctx, A_TODAY));
        v.setOnClickPendingIntent(R.id.grid, openApp(ctx));
        v.setOnClickPendingIntent(R.id.list, openApp(ctx));
        v.setOnClickPendingIntent(R.id.sum, openApp(ctx));
        v.setImageViewResource(R.id.eye, reveal ? R.drawable.w_eye : R.drawable.w_eye_off);

        // how much room we have (dp) decides: calendar + list, or list only
        Bundle o = m.getAppWidgetOptions(wid);
        int h = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0) : 0;
        if (h <= 0 && o != null) h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        if (h <= 0) h = 360;
        boolean showGrid = h >= 230;

        if (snap == null) {
            v.setTextViewText(R.id.title, "Clearli");
            v.setTextViewText(R.id.sum, "Open Clearli once to fill this widget");
            v.setViewVisibility(R.id.grid, View.GONE);
            v.setViewVisibility(R.id.div, View.GONE);
            v.setViewVisibility(R.id.list, View.GONE);
            v.setTextViewText(R.id.foot, "");
            v.setOnClickPendingIntent(R.id.root, openApp(ctx));
            m.updateAppWidget(wid, v);
            return;
        }

        int ws = snap.optInt("ws", 0);
        NumberFormat nf = NumberFormat.getCurrencyInstance(Locale.getDefault());
        String sym = "$";
        try { Currency cur = Currency.getInstance(snap.optString("cur", "USD")); nf.setCurrency(cur); sym = cur.getSymbol(); } catch (Exception ignored) { }
        NumberFormat whole = (NumberFormat) nf.clone();
        whole.setMaximumFractionDigits(0);
        whole.setMinimumFractionDigits(0);
        String mask = sym + "•••";

        // index items by day
        JSONArray items = snap.optJSONArray("items");
        if (items == null) items = new JSONArray();
        HashMap<String, int[]> marks = new HashMap<>(); // [paid count, due count]
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            int[] mk = marks.get(it.optString("d"));
            if (mk == null) { mk = new int[2]; marks.put(it.optString("d"), mk); }
            mk[it.optInt("p") == 1 ? 0 : 1]++;
        }

        Calendar today = Calendar.getInstance();
        today.set(Calendar.HOUR_OF_DAY, 0); today.set(Calendar.MINUTE, 0); today.set(Calendar.SECOND, 0); today.set(Calendar.MILLISECOND, 0);
        String tKey = key(today);
        Calendar mStart = (Calendar) today.clone();
        mStart.set(Calendar.DAY_OF_MONTH, 1);
        mStart.add(Calendar.MONTH, off);
        int month = mStart.get(Calendar.MONTH);
        v.setTextViewText(R.id.title, MON[month] + (mStart.get(Calendar.YEAR) != today.get(Calendar.YEAR) ? " " + mStart.get(Calendar.YEAR) : ""));

        // month totals: bills paid / still due, income expected
        String mPrefix = String.format(Locale.US, "%04d-%02d-", mStart.get(Calendar.YEAR), month + 1);
        double paid = 0, due = 0, inc = 0;
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null || !it.optString("d").startsWith(mPrefix)) continue;
            double a = it.optDouble("v", 0);
            if (a < 0) { if (it.optInt("p") == 1) paid -= a; else due -= a; } else inc += a;
        }
        String S = "Bills paid " + (reveal ? whole.format(paid) : mask) + "  ·  due " + (reveal ? whole.format(due) : mask) + (inc > 0 ? "  ·  in " + (reveal ? whole.format(inc) : mask) : "");
        v.setTextViewText(R.id.sum, S);

        // calendar grid
        v.setViewVisibility(R.id.grid, showGrid ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.prev, showGrid ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.next, showGrid ? View.VISIBLE : View.GONE);
        int rowsUsed = 0;
        if (showGrid) {
            for (int i = 0; i < 7; i++) v.setTextViewText(id(ctx, "h" + i), DOW[(i + ws) % 7]);
            Calendar c = (Calendar) mStart.clone();
            int lead = (c.get(Calendar.DAY_OF_WEEK) - 1 - ws + 7) % 7;
            c.add(Calendar.DAY_OF_MONTH, -lead);
            for (int i = 0; i < 42; i++) {
                int cid = id(ctx, "c" + i);
                boolean in = c.get(Calendar.MONTH) == month;
                String k = key(c);
                v.setTextViewText(cid, String.valueOf(c.get(Calendar.DAY_OF_MONTH)));
                int[] mk = marks.get(k);
                int bg = 0;
                int color = in ? Color.parseColor("#E6E9FA") : Color.parseColor("#4A5275");
                if (k.equals(tKey)) { bg = R.drawable.w_today; color = Color.WHITE; }
                else if (mk != null && mk[1] > 0) bg = R.drawable.w_due;
                else if (mk != null && mk[0] > 0) bg = R.drawable.w_paid;
                if (!in && bg != R.drawable.w_today) bg = 0;
                v.setInt(cid, "setBackgroundResource", bg);
                v.setTextColor(cid, color);
                if (in) rowsUsed = i / 7 + 1;
                c.add(Calendar.DAY_OF_MONTH, 1);
            }
            for (int w = 0; w < 6; w++) v.setViewVisibility(id(ctx, "wk" + w), w < rowsUsed ? View.VISIBLE : View.GONE);
        }

        // upcoming list: from today, next 30 days
        int fixed = 24 + 28 + 18 + 14 + 14 + (showGrid ? 20 + 22 * rowsUsed + 11 : 0);
        int maxRows = Math.max(1, Math.min(5, (h - fixed) / 22));
        ArrayList<JSONObject> up = new ArrayList<>();
        Calendar lim = (Calendar) today.clone();
        lim.add(Calendar.DAY_OF_MONTH, 30);
        String limKey = key(lim);
        for (int i = 0; i < items.length() && up.size() < maxRows; i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null || it.optInt("p") == 1) continue;
            String d = it.optString("d");
            if (d.compareTo(tKey) >= 0 && d.compareTo(limKey) <= 0) up.add(it);
        }
        v.setViewVisibility(R.id.div, View.VISIBLE);
        v.setViewVisibility(R.id.list, View.VISIBLE);
        v.setViewVisibility(R.id.empty, up.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < 5; i++) {
            int rid = id(ctx, "r" + i);
            if (i >= up.size()) { v.setViewVisibility(rid, View.GONE); continue; }
            JSONObject it = up.get(i);
            v.setViewVisibility(rid, View.VISIBLE);
            v.setTextViewText(id(ctx, "rd" + i), when(it.optString("d"), today));
            String tag = it.optString("t", "");
            SpannableString nm = new SpannableString("● " + it.optString("n") + (reveal && tag.length() > 0 ? " · " + tag : ""));
            int dot;
            try { dot = Color.parseColor(it.optString("c", "#8A93B8")); } catch (Exception e) { dot = Color.GRAY; }
            nm.setSpan(new ForegroundColorSpan(dot), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(id(ctx, "rn" + i), nm);
            double a = it.optDouble("v", 0);
            int aid = id(ctx, "ra" + i);
            v.setTextViewText(aid, reveal ? (a > 0 ? "+" : "−") + nf.format(Math.abs(a)) : mask);
            v.setTextColor(aid, reveal && a > 0 ? Color.parseColor("#3DDC97") : Color.parseColor("#F2F4FF"));
        }

        long gen = snap.optLong("gen", 0);
        long mins = (System.currentTimeMillis() - gen) / 60000;
        String ago = mins < 1 ? "just now" : mins < 60 ? mins + "m ago" : mins < 1440 ? (mins / 60) + "h ago" : (mins / 1440) + "d ago";
        v.setTextViewText(R.id.foot, (reveal ? "Hides again in a minute · " : "") + "Updated " + ago);
        m.updateAppWidget(wid, v);
    }

    private static String when(String d, Calendar today) {
        try {
            String[] p = d.split("-");
            Calendar c = Calendar.getInstance();
            c.clear();
            c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            long days = Math.round((c.getTimeInMillis() - today.getTimeInMillis()) / 86400000.0);
            if (days == 0) return "Today";
            if (days == 1) return "Tomorrow";
            if (days < 7) return SDOW[c.get(Calendar.DAY_OF_WEEK) - 1];
            return SMON[c.get(Calendar.MONTH)] + " " + c.get(Calendar.DAY_OF_MONTH);
        } catch (Exception e) {
            return d;
        }
    }
}
