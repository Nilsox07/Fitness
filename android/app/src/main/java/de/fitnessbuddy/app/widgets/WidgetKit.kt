package de.fitnessbuddy.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import de.fitnessbuddy.app.MainActivity
import de.fitnessbuddy.app.R
import org.json.JSONObject
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt

internal val DE: NumberFormat = NumberFormat.getIntegerInstance(Locale.GERMANY)

/** Tippen öffnet die App direkt auf der passenden Seite (Deep Link fitnessbuddy://open/…). */
internal fun openApp(ctx: Context, path: String, req: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("fitnessbuddy://open$path"), ctx, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(ctx, req, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}

/** „+250 ml“ als Broadcast – bucht, ohne die App zu öffnen. */
internal fun addWaterIntent(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
    ctx,
    Req.WATER_ADD,
    Intent(ctx, WaterAddReceiver::class.java).setAction(WaterAddReceiver.ACTION),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
)

/** Feste Request-Codes, damit sich die PendingIntents nicht gegenseitig überschreiben. */
internal object Req {
    const val TODAY = 1
    const val WATER_ADD = 2
    const val TRAINING = 3
    const val READINESS = 4
    const val BUDDY = 5
    const val WATER = 6
    const val CALORIES = 7
    const val STEPS = 8
    const val SLEEP = 9
    const val FASTING = 10
    const val QUESTS = 11
    const val SUPPLEMENTS = 12
    const val MODULES = 13
}

/** 7:05 */
internal fun hm(min: Int) = "${min / 60}:${(min % 60).toString().padStart(2, '0')}"

/** 1,25 l / 2,5 l */
internal fun liters(ml: Int): String {
    val s = String.format(Locale.GERMANY, "%.2f", ml / 1000.0).trimEnd('0').trimEnd(',')
    return "$s l"
}

/** Lesezugriff auf den Snapshot: fehlende, leere oder veraltete Felder werden still ersetzt. */
internal class Snap(private val j: JSONObject) {
    val isEmpty = j.length() == 0

    /** Stammt der Stand von heute? Sonst zählen Tageswerte als 0. */
    val fresh = isToday(j.optLong("updatedAt", 0))

    fun has(k: String) = j.has(k) && !j.isNull(k)

    fun num(k: String): Double? = if (has(k)) j.optDouble(k).takeIf { !it.isNaN() } else null

    fun int(k: String): Int? = num(k)?.roundToInt()

    fun int(k: String, def: Int): Int = int(k) ?: def

    /** Tageswert: von gestern → 0. */
    fun daily(k: String): Int? = int(k)?.let { if (fresh) it else 0 }

    fun str(k: String): String? =
        if (has(k)) j.optString(k).trim().takeIf { it.isNotEmpty() && it != "null" } else null

    fun bool(k: String, def: Boolean) = if (has(k)) j.optBoolean(k, def) else def

    fun obj(k: String): JSONObject? = if (has(k)) j.optJSONObject(k) else null

    fun color(k: String): Int? = str(k)?.let { runCatching { Color.parseColor(it) }.getOrNull() }

    companion object {
        fun load(ctx: Context) = Snap(WidgetStore.snapshot(ctx))

        fun isToday(epochMs: Long): Boolean =
            epochMs > 0 && Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).toLocalDate() == LocalDate.now()
    }
}

/** Farben + Zeichen-Helfer für einen Durchlauf (ein Snapshot, ein Hell/Dunkel-Zustand). */
internal class Kit(val ctx: Context, val s: Snap) {
    val night = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    val accent = s.color("accent") ?: DEFAULT_ACCENT
    val accentLight = s.color("accentLight") ?: WidgetArt.mix(accent, Color.WHITE, 0.35f)
    val onAccent = s.color("onAccent") ?: Color.WHITE
    val track = WidgetArt.alpha(accent, if (night) 0.22f else 0.15f)
    val success = ctx.getColor(R.color.widget_success)
    val gold = ctx.getColor(R.color.widget_gold)

    private val glowBitmap: Bitmap by lazy { WidgetArt.glow(ctx, GLOW_DP, accent, night) }

    /** Neue Ansicht mit Karte, Akzent-Schein und Akzent-Punkt vor dem Überschrift-Label. */
    fun views(layout: Int): RemoteViews = RemoteViews(ctx.packageName, layout).also { v ->
        v.setImageViewBitmap(R.id.glow, glowBitmap)
        v.setInt(R.id.dot, "setColorFilter", accent)
    }

    fun ring(v: RemoteViews, id: Int, sizeDp: Float, pct: Float, color: Int = accent, light: Int = accentLight) =
        v.setImageViewBitmap(id, WidgetArt.ring(ctx, sizeDp, pct, color, light, track))

    fun bar(v: RemoteViews, id: Int, wDp: Float, hDp: Float, pct: Float, color: Int = accent) =
        v.setImageViewBitmap(id, WidgetArt.bar(ctx, wDp, hDp, pct, color, track))

    fun dots(v: RemoteViews, id: Int, count: Int, done: Int, color: Int = accent) =
        v.setImageViewBitmap(id, WidgetArt.dots(ctx, count, done, color, track))

    /** Akzent-Knopf: Fläche einfärben, Schrift in onAccent. */
    fun pill(v: RemoteViews, bgId: Int, textId: Int) {
        v.setInt(bgId, "setColorFilter", accent)
        v.setTextColor(textId, onAccent)
    }

    /** Buddy-Bild mit Lichthof; ohne Bild das Emoji. */
    fun buddy(v: RemoteViews, haloDp: Float, buddyDp: Float) {
        v.setImageViewBitmap(R.id.halo, WidgetArt.halo(ctx, haloDp, accent, night))
        val img = WidgetArt.buddy(ctx, buddyDp)
        if (img != null) {
            v.setImageViewBitmap(R.id.buddy, img)
            v.setViewVisibility(R.id.buddy, View.VISIBLE)
            v.setViewVisibility(R.id.buddy_emoji, View.GONE)
        } else {
            v.setViewVisibility(R.id.buddy, View.GONE)
            v.setViewVisibility(R.id.buddy_emoji, View.VISIBLE)
            v.setTextViewText(R.id.buddy_emoji, s.str("buddyEmoji") ?: "🐤")
        }
    }

    /** Inhalt ausblenden und Hinweis zeigen. */
    fun empty(v: RemoteViews, title: String, hint: String? = null) {
        v.setViewVisibility(R.id.content, View.GONE)
        v.setViewVisibility(R.id.empty, View.VISIBLE)
        v.setTextViewText(R.id.empty_title, title)
        v.setTextViewText(R.id.empty_hint, hint ?: "")
        v.setViewVisibility(R.id.empty_hint, if (hint.isNullOrEmpty()) View.GONE else View.VISIBLE)
    }

    fun click(v: RemoteViews, path: String, req: Int, id: Int = android.R.id.background) =
        v.setOnClickPendingIntent(id, openApp(ctx, path, req))

    /** Typische Hinweise. true = Hinweis gezeigt, Widget fertig. */
    fun needsData(v: RemoteViews): Boolean {
        if (!s.isEmpty) return false
        empty(v, "Noch keine Daten", "Öffne die App einmal, dann geht's los")
        click(v, "/", Req.MODULES)
        return true
    }

    fun needsNutrition(v: RemoteViews): Boolean {
        if (s.bool("showNutrition", true)) return false
        empty(v, "Ernährung ist aus", "Unter Profil → Bereiche einschalten")
        click(v, "/profile?s=modules", Req.MODULES)
        return true
    }

    fun needsWatch(v: RemoteViews): Boolean {
        if (s.bool("hasWatch", false)) return false
        empty(v, "Uhr verbinden", "Profil → Bereiche → Smartwatch")
        click(v, "/profile?s=modules", Req.MODULES)
        return true
    }

    companion object {
        val DEFAULT_ACCENT = Color.parseColor("#E11D48")
        const val GLOW_DP = 170f
    }
}

/**
 * Basis aller Widgets: liest den Snapshot, zeichnet bei Updates und
 * Größenänderung neu. Fehler in einem Widget dürfen die anderen nicht stören.
 */
abstract class BaseWidget : AppWidgetProvider() {
    internal abstract fun render(k: Kit, opts: Bundle): RemoteViews

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val k = Kit(ctx, Snap.load(ctx))
        for (id in ids) push(k, mgr, id)
    }

    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, newOptions: Bundle) {
        push(Kit(ctx, Snap.load(ctx)), mgr, id)
    }

    private fun push(k: Kit, mgr: AppWidgetManager, id: Int) {
        runCatching { mgr.updateAppWidget(id, render(k, mgr.getAppWidgetOptions(id))) }
            .onFailure { Log.w("Widgets", "${javaClass.simpleName}: ${it.message}") }
    }

    /**
     * Mehrere Layouts je Größe. Ab Android 12 wählt der Launcher selbst,
     * davor entscheiden wir anhand der gemeldeten Größe (Hochformat).
     */
    internal fun sized(opts: Bundle, vararg variants: Pair<SizeF, () -> RemoteViews>): RemoteViews {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return RemoteViews(variants.associate { it.first to it.second() })
        }
        val w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
        val h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
        val fit = variants.filter { w >= it.first.width && h >= it.first.height }
            .maxByOrNull { it.first.width * it.first.height }
        return (fit ?: variants.minBy { it.first.width * it.first.height }).second()
    }
}
