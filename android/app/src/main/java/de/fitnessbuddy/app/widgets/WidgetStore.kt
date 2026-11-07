package de.fitnessbuddy.app.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import org.json.JSONObject
import java.io.File
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

    /** Alle Widget-Klassen – neue Widgets hier eintragen. */
    val ALL: List<Class<out BaseWidget>> = listOf(
        BuddyWidget::class.java,
        TodayWidget::class.java,
        WaterWidget::class.java,
        CaloriesWidget::class.java,
        TrainingWidget::class.java,
        ReadinessWidget::class.java,
        StepsWidget::class.java,
        SleepWidget::class.java,
        FastingWidget::class.java,
        QuestsWidget::class.java,
        SupplementsWidget::class.java,
        FoodLogWidget::class.java,
        TrainingStartWidget::class.java,
        WeightWidget::class.java,
        OutdoorWidget::class.java,
        CardioWidget::class.java,
    )

    /** Tageswerte, die nach Mitternacht nicht mehr gelten. */
    internal val DAILY = listOf("kcalEaten", "proteinEaten", "waterMl", "steps", "questsDone", "supplementsDone")

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
        // Stand von gestern? Dann beginnt der Tag bei null.
        if (!Snap.isToday(snap.optLong("updatedAt", 0))) {
            for (k in DAILY) if (snap.has(k)) snap.put(k, 0)
            snap.put("updatedAt", System.currentTimeMillis())
        }
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

    /** Buddy-Bild (Base64-PNG) speichern; leer = löschen. false, wenn kein gültiges Bild. */
    fun saveBuddy(ctx: Context, base64: String): Boolean {
        val file = File(ctx.filesDir, WidgetArt.BUDDY_FILE)
        if (base64.isBlank()) {
            file.delete()
            refreshAll(ctx)
            return true
        }
        val bytes = runCatching { Base64.decode(base64.substringAfter("base64,"), Base64.DEFAULT) }.getOrNull() ?: return false
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth > 2048 || bounds.outHeight > 2048) return false
        val tmp = File(ctx.filesDir, WidgetArt.BUDDY_FILE + ".tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(file)) {
            file.writeBytes(bytes)
            tmp.delete()
        }
        refreshAll(ctx)
        return true
    }

    private fun pending(ctx: Context): JSONObject =
        runCatching { JSONObject(prefs(ctx).getString(KEY_PENDING, "{}") ?: "{}") }.getOrDefault(JSONObject())

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun refreshAll(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        for (cls in ALL) {
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

    /**
     * Widgets zu einem Zeitpunkt neu zeichnen (z. B. Fastenende). Ungenau reicht, braucht keine Sonderrechte.
     * Eigener [req] je Anlass, sonst ersetzt ein Wecker den anderen.
     */
    fun scheduleRefresh(ctx: Context, atMillis: Long, req: Int = REQ_REFRESH) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = PendingIntent.getBroadcast(
            ctx,
            req,
            Intent(ctx, WidgetRefreshReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        am.set(AlarmManager.RTC, atMillis, pi)
    }

    private const val REQ_REFRESH = 90

    /** Wechsel der Mahlzeit im Widget „Essen eintragen“. */
    internal const val REQ_REFRESH_MEAL = 91
}

/** Weckt die Widgets zum geplanten Zeitpunkt. */
class WidgetRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) = WidgetStore.refreshAll(ctx)
}
