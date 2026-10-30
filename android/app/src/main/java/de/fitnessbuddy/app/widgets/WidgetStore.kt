package de.fitnessbuddy.app.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.time.LocalDate

/**
 * Zwischenspeicher für die Homescreen-Widgets. Die App schreibt nach jeder
 * Änderung eine kleine Zusammenfassung hinein; Wasser aus dem Widget wird hier
 * gesammelt und beim nächsten App-Start nach Supabase übernommen.
 */
object WidgetStore {
    private const val PREFS = "widgets"
    private const val KEY_SNAPSHOT = "snapshot"
    private const val KEY_PENDING = "pending_water"

    fun snapshot(ctx: Context): JSONObject =
        runCatching { JSONObject(prefs(ctx).getString(KEY_SNAPSHOT, "{}") ?: "{}") }.getOrDefault(JSONObject())

    fun saveSnapshot(ctx: Context, json: String) {
        prefs(ctx).edit().putString(KEY_SNAPSHOT, json).apply()
        refreshAll(ctx)
    }

    /** +ml aus dem Widget: sofort anzeigen und für die App vormerken. */
    fun addWater(ctx: Context, ml: Int) {
        val today = LocalDate.now().toString()
        val pending = pending(ctx)
        pending.put(today, pending.optInt(today, 0) + ml)
        val snap = snapshot(ctx)
        snap.put("waterMl", snap.optInt("waterMl", 0) + ml)
        prefs(ctx).edit()
            .putString(KEY_PENDING, pending.toString())
            .putString(KEY_SNAPSHOT, snap.toString())
            .apply()
        refreshAll(ctx)
    }

    /** Vorgemerktes Wasser abholen (und leeren). */
    fun takePending(ctx: Context): JSONObject {
        val p = pending(ctx)
        prefs(ctx).edit().remove(KEY_PENDING).apply()
        return p
    }

    private fun pending(ctx: Context): JSONObject =
        runCatching { JSONObject(prefs(ctx).getString(KEY_PENDING, "{}") ?: "{}") }.getOrDefault(JSONObject())

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun refreshAll(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        for (cls in listOf(TodayWidget::class.java, TrainingWidget::class.java, ReadinessWidget::class.java)) {
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, cls))
            if (ids.isEmpty()) continue
            ctx.sendBroadcast(
                Intent(ctx, cls).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                },
            )
        }
    }
}
