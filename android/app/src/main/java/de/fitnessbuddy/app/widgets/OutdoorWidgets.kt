package de.fitnessbuddy.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.provider.AlarmClock
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import de.fitnessbuddy.app.R
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.util.Locale
import kotlin.math.roundToInt

private fun deg(t: Double) = "${t.roundToInt()}°"

/** Uhr antippen öffnet den Wecker (wie bei einer normalen Uhr-Anzeige). */
private fun alarms(ctx: Context): PendingIntent = PendingIntent.getActivity(
    ctx,
    Req.OUTDOOR_CLOCK,
    Intent(AlarmClock.ACTION_SHOW_ALARMS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
)

/**
 * Laufwetter: Uhrzeit, Datum, Wetter jetzt, Einschätzung für Laufen/Rad/Gehen, Kleidungstipp,
 * beste Stunde und (ab 4×3) die nächsten Stunden. Wetter von Bright Sky (DWD), alle 30 min.
 */
class OutdoorWidget : BaseWidget() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        super.onUpdate(ctx, mgr, ids)
        val loc = WeatherRepo.location(Snap.load(ctx)) ?: return
        if (!WeatherRepo.stale(ctx, loc.first, loc.second)) return
        val pending = goAsync()
        WeatherRepo.refreshAsync(ctx.applicationContext, loc.first, loc.second) {
            runCatching {
                val k = Kit(ctx, Snap.load(ctx))
                val all = mgr.getAppWidgetIds(ComponentName(ctx, OutdoorWidget::class.java))
                for (id in all) mgr.updateAppWidget(id, render(k, mgr.getAppWidgetOptions(id)))
            }
            pending.finish()
        }
    }

    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val d = dims(opts, 300f, 140f)
        val art = k.actionArt(d.width, d.height)
        return sized(
            opts,
            SizeF(110f, 100f) to { build(k, art, Layout.SQUARE, d.width) },
            SizeF(240f, 100f) to { build(k, art, Layout.WIDE, d.width) },
            SizeF(240f, 170f) to { build(k, art, Layout.TALL, d.width) },
        )
    }

    private enum class Layout { SQUARE, WIDE, TALL }

    private fun build(k: Kit, art: Bitmap, layout: Layout, widthDp: Float): RemoteViews {
        val ctx = k.ctx
        val v = RemoteViews(ctx.packageName, if (layout == Layout.SQUARE) R.layout.widget_outdoor_square else R.layout.widget_outdoor)
        v.setImageViewBitmap(R.id.art, art)
        k.click(v, "/cardio", Req.OUTDOOR)
        v.setOnClickPendingIntent(R.id.clock, alarms(ctx))
        val wide = layout != Layout.SQUARE
        if (wide) v.setViewVisibility(R.id.hours, if (layout == Layout.TALL) View.VISIBLE else View.GONE)

        val s = k.s
        val sport = Sport.of(s.obj("cardio")?.optString("kind"))
        val loc = WeatherRepo.location(s)
        val cache = WeatherRepo.load(ctx)
        fun message(title: String, hint: String) {
            v.setViewVisibility(R.id.now_box, View.GONE)
            v.setTextViewText(R.id.headline, title)
            v.setTextViewText(R.id.tip, if (wide) "· $hint" else hint)
            if (wide) {
                v.setViewVisibility(R.id.hours, View.GONE)
                v.setTextViewText(R.id.best, "")
            }
        }
        if (loc == null) {
            message("Ort fürs Wetter fehlt", "In der App: Profil → Einstellungen")
            k.click(v, "/profile?s=settings", Req.OUTDOOR)
            return v
        }
        if (cache == null || cache.hours.isEmpty()) {
            message("Wetter wird geladen …", "Braucht kurz Internet")
            return v
        }

        val zone = ZoneId.systemDefault()
        val nowHour = LocalTime.now().hour
        val hours = cache.hours
        val cur = hours.firstOrNull { it.dayOffset == 0 && it.hour == nowHour }
        val temp = cache.now?.temp ?: cur?.temp ?: hours.first().temp
        val wind = cache.now?.wind ?: cur?.wind ?: 0.0
        val feels = Outdoor.feelsLike(temp, wind)
        val icon = cache.now?.icon ?: cur?.icon

        v.setViewVisibility(R.id.now_box, View.VISIBLE)
        v.setImageViewBitmap(R.id.icon, WeatherArt.icon(ctx, if (wide) 36f else 28f, icon, k.heroGold))
        v.setTextViewText(R.id.temp, deg(temp))
        val dir = Outdoor.windDir(cache.now?.windDeg)
        val feelText = if ((feels - temp).roundToInt() != 0) "gefühlt ${deg(feels)}" else null
        v.setTextViewText(
            R.id.feel,
            if (wide) listOfNotNull(feelText, "${wind.roundToInt()} km/h $dir".trim()).joinToString(" · ")
            else feelText ?: "${wind.roundToInt()} km/h",
        )

        val (head, _) = Outdoor.headline(hours, nowHour, sport)
        val soonWet = hours.filter { it.dayOffset == 0 && it.hour in nowHour..nowHour + 2 }
            .any { (it.rainProb ?: 0) >= 50 || it.rainMm >= 0.3 }
        val clothes = Outdoor.clothing(feels, soonWet, sport)
        v.setTextViewText(R.id.headline, head)
        v.setTextViewText(R.id.tip, if (wide) "· $clothes" else clothes)

        if (wide) {
            val today = LocalDate.now(zone)
            val offset = zone.rules.getOffset(java.time.Instant.now()).totalSeconds / 60
            val sun = Outdoor.sun(loc.first, loc.second, today.dayOfYear, offset)
            val best = Outdoor.bestHour(hours, nowHour, sun?.first, sun?.second, sport)
            val parts = mutableListOf<String>()
            if (best != null) parts += "Am besten ${if (best.dayOffset == 1) "morgen " else ""}${best.hour} Uhr"
            if (sun != null) {
                val nowMin = LocalTime.now().let { it.hour * 60 + it.minute }
                parts += if (nowMin < sun.second) "hell bis ${hm(sun.second)}" else "hell ab ${hm(sun.first)}"
            }
            v.setTextViewText(R.id.best, parts.joinToString(" · "))
            if (layout == Layout.TALL) hourStrip(k, v, hours, nowHour, widthDp, best)
        }
        return v
    }

    /** Die nächsten Stunden als Spalten; die beste Stunde ist hinterlegt. */
    private fun hourStrip(k: Kit, v: RemoteViews, hours: List<Hour>, nowHour: Int, widthDp: Float, best: Hour?) {
        val n = ((widthDp - 28f) / 44f).toInt().coerceIn(4, 8)
        val next = hours.filter { it.dayOffset > 0 || it.hour >= nowHour }.take(n)
        v.removeAllViews(R.id.hours)
        for ((i, h) in next.withIndex()) {
            val col = RemoteViews(k.ctx.packageName, R.layout.widget_hour_col)
            col.setTextViewText(R.id.h_time, if (i == 0) "Jetzt" else "${h.hour}")
            col.setImageViewBitmap(R.id.h_icon, WeatherArt.icon(k.ctx, 20f, h.icon, k.heroGold))
            col.setTextViewText(R.id.h_temp, deg(h.temp))
            val prob = (h.rainProb ?: if (h.rainMm > 0.1) 70 else 0) / 100f
            k.heroBar(col, R.id.h_rain, 22f, 3f, prob, k.accentLight)
            if (best != null && h.dayOffset == best.dayOffset && h.hour == best.hour) {
                col.setInt(R.id.col, "setBackgroundResource", R.drawable.widget_hour_best)
            }
            v.addView(R.id.hours, col)
        }
    }
}

/** Ausdauer-Woche: km je Tag als Balken, letzte Einheit, was laut Plan ansteht. */
class CardioWidget : BaseWidget() {
    override fun render(k: Kit, opts: Bundle): RemoteViews {
        val d = dims(opts, 300f, 140f)
        val art = k.actionArt(d.width, d.height)
        return sized(
            opts,
            SizeF(110f, 100f) to { build(k, art, false, d.width) },
            SizeF(240f, 100f) to { build(k, art, true, d.width) },
        )
    }

    private fun build(k: Kit, art: Bitmap, wide: Boolean, widthDp: Float): RemoteViews {
        val v = RemoteViews(k.ctx.packageName, if (wide) R.layout.widget_cardio else R.layout.widget_cardio_square)
        v.setImageViewBitmap(R.id.art, art)
        if (k.needsData(v)) return v
        val s = k.s
        val c = s.obj("cardio")
        val plan = c?.optString("plan")?.takeIf { it.isNotBlank() && it != "null" }
        if (!s.bool("hasWatch", false) && plan == null) {
            k.needsWatch(v)
            return v
        }
        k.click(v, "/cardio", Req.CARDIO)
        v.setTextViewText(R.id.overline, "Ausdauer · ${k.day}")

        // Wochenwerte gelten nur, wenn der Stand aus dieser Woche (ab Montag) stammt
        val monday = LocalDate.now().minusDays((LocalDate.now().dayOfWeek.value - 1).toLong())
        val upd = s.num("updatedAt")?.toLong()?.let {
            java.time.Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).toLocalDate()
        }
        val fresh = upd != null && !upd.isBefore(monday)
        val km = if (fresh) c?.optDouble("weekKm", 0.0)?.takeIf { !it.isNaN() } ?: 0.0 else 0.0
        val count = if (fresh) c?.optInt("weekCount", 0) ?: 0 else 0
        val min = if (fresh) c?.optInt("weekMin", 0) ?: 0 else 0
        v.setTextViewText(R.id.km, String.format(Locale.GERMANY, if (km >= 100) "%.0f" else "%.1f", km))
        v.setTextViewText(
            R.id.sub,
            if (count == 0) "Diese Woche noch nichts" else "$count ${if (count == 1) "Einheit" else "Einheiten"} · ${hm(min)} h",
        )

        val days = DoubleArray(7)
        if (fresh) c?.optJSONArray("days")?.let { a -> for (i in 0 until minOf(7, a.length())) days[i] = a.optDouble(i, 0.0) }
        val today = LocalDate.now().dayOfWeek.value - 1
        val barW = if (wide) (widthDp - 28f - 25f) * 0.52f else widthDp - 28f
        v.setImageViewBitmap(R.id.week, WeatherArt.week(k.ctx, barW, if (wide) 40f else 34f, days, today, k.accentLight, k.heroTrackColor))

        if (wide) {
            val last = c?.optJSONObject("last")
            if (last != null) {
                v.setTextViewText(R.id.last_title, "${last.optString("label")} · ${last.optString("when")}")
                v.setTextViewText(R.id.last_sub, listOf(last.optString("dist"), last.optString("pace")).filter { it.isNotBlank() }.joinToString(" · "))
            } else {
                v.setTextViewText(R.id.last_title, "Noch keine Einheit")
                v.setTextViewText(R.id.last_sub, "Kommt von deiner Uhr")
            }
            v.setViewVisibility(R.id.plan_over, if (plan != null) View.VISIBLE else View.GONE)
        }
        v.setTextViewText(R.id.plan, plan ?: "")
        v.setViewVisibility(R.id.plan, if (plan != null) View.VISIBLE else View.GONE)
        return v
    }
}
