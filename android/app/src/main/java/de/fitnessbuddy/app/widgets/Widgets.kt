package de.fitnessbuddy.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import de.fitnessbuddy.app.MainActivity
import de.fitnessbuddy.app.R
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

private val DE = NumberFormat.getIntegerInstance(Locale.GERMANY)

/** Tippen öffnet die App direkt auf der passenden Seite (Deep Link fitnessbuddy://open/…). */
internal fun openApp(ctx: Context, path: String, req: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("fitnessbuddy://open$path"), ctx, MainActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(ctx, req, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}

private fun hours(min: Int) = "${min / 60}:${(min % 60).toString().padStart(2, '0')} h"

/** Ernährung heute: Kalorien übrig, Eiweiß, Wasser mit +250-ml-Knopf. */
class TodayWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val s = WidgetStore.snapshot(ctx)
        for (id in ids) {
            val v = RemoteViews(ctx.packageName, R.layout.widget_today)
            v.setOnClickPendingIntent(R.id.root, openApp(ctx, "/nutrition", 1))
            if (!s.optBoolean("showNutrition", true)) {
                v.setViewVisibility(R.id.content, View.GONE)
                v.setViewVisibility(R.id.empty, View.VISIBLE)
                v.setTextViewText(R.id.empty, "Ernährung ist ausgeblendet")
            } else if (!s.has("kcalTarget")) {
                v.setViewVisibility(R.id.content, View.GONE)
                v.setViewVisibility(R.id.empty, View.VISIBLE)
                v.setTextViewText(R.id.empty, "App einmal öffnen, um das Widget zu füllen")
            } else {
                v.setViewVisibility(R.id.content, View.VISIBLE)
                v.setViewVisibility(R.id.empty, View.GONE)
                val target = s.optInt("kcalTarget", 0)
                val eaten = s.optInt("kcalEaten", 0)
                val left = target - eaten
                v.setTextViewText(R.id.kcal_left, DE.format(abs(left)))
                v.setTextViewText(R.id.kcal_label, if (left >= 0) "kcal übrig" else "kcal drüber")
                v.setProgressBar(R.id.kcal_ring, 100, if (target > 0) (eaten * 100 / target).coerceIn(0, 100) else 0, false)
                val pT = s.optInt("proteinTarget", 0)
                val pE = s.optInt("proteinEaten", 0)
                v.setTextViewText(R.id.protein_text, "Eiweiß  $pE / $pT g")
                v.setProgressBar(R.id.protein_bar, 100, if (pT > 0) (pE * 100 / pT).coerceIn(0, 100) else 0, false)
                val wT = s.optInt("waterTarget", 2500)
                val wM = s.optInt("waterMl", 0)
                v.setTextViewText(
                    R.id.water_text,
                    "Wasser  ${String.format(Locale.GERMANY, "%.2f", wM / 1000.0).trimEnd('0').trimEnd(',')} / ${String.format(Locale.GERMANY, "%.1f", wT / 1000.0)} l",
                )
                v.setProgressBar(R.id.water_bar, 100, if (wT > 0) (wM * 100 / wT).coerceIn(0, 100) else 0, false)
                val add = Intent(ctx, WaterAddReceiver::class.java).setAction(WaterAddReceiver.ACTION)
                v.setOnClickPendingIntent(
                    R.id.water_add,
                    PendingIntent.getBroadcast(ctx, 2, add, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
                )
            }
            mgr.updateAppWidget(id, v)
        }
    }
}

/** Training: was heute ansteht, Serie und Wochenziel. */
class TrainingWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val s = WidgetStore.snapshot(ctx)
        for (id in ids) {
            val v = RemoteViews(ctx.packageName, R.layout.widget_training)
            v.setOnClickPendingIntent(R.id.root, openApp(ctx, "/", 3))
            val next = s.optString("nextWorkout").takeIf { it.isNotBlank() && it != "null" }
            v.setTextViewText(
                R.id.next,
                when {
                    next != null -> next
                    s.optBoolean("restDay") -> "Ruhetag"
                    else -> "Freies Training"
                },
            )
            val weeks = s.optInt("streakWeeks", 0)
            v.setTextViewText(R.id.streak, "🔥 $weeks ${if (weeks == 1) "Woche" else "Wochen"}")
            v.setTextViewText(R.id.week, "${s.optInt("weekDone", 0)} / ${s.optInt("weekGoal", 3)} diese Woche")
            val goal = s.optInt("weekGoal", 3).coerceAtLeast(1)
            v.setProgressBar(R.id.week_bar, goal, s.optInt("weekDone", 0).coerceAtMost(goal), false)
            mgr.updateAppWidget(id, v)
        }
    }
}

/** Tagesform von der Uhr: Zahl, Schlaf, Schritte. */
class ReadinessWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val s = WidgetStore.snapshot(ctx)
        for (id in ids) {
            val v = RemoteViews(ctx.packageName, R.layout.widget_readiness)
            if (!s.optBoolean("hasWatch")) {
                v.setOnClickPendingIntent(R.id.root, openApp(ctx, "/profile?s=modules", 4))
                v.setTextViewText(R.id.score, "–")
                v.setTextViewText(R.id.advice, "Uhr verbinden")
                v.setTextViewText(R.id.details, "Profil → Bereiche")
            } else {
                v.setOnClickPendingIntent(R.id.root, openApp(ctx, "/sleep", 4))
                val score = if (s.isNull("readiness")) null else s.optInt("readiness")
                v.setTextViewText(R.id.score, score?.toString() ?: "–")
                v.setProgressBar(R.id.ring, 100, score ?: 0, false)
                v.setTextViewText(
                    R.id.advice,
                    when {
                        score == null -> "Noch keine Nacht"
                        score >= 75 -> "Gib heute Gas"
                        score >= 50 -> "Normal trainieren"
                        else -> "Heute locker"
                    },
                )
                val parts = mutableListOf<String>()
                if (!s.isNull("sleepMin") && s.has("sleepMin")) parts += "😴 ${hours(s.optInt("sleepMin"))}"
                if (!s.isNull("steps") && s.has("steps")) parts += "👟 ${DE.format(s.optInt("steps"))}"
                v.setTextViewText(R.id.details, parts.joinToString("  "))
            }
            mgr.updateAppWidget(id, v)
        }
    }
}

/** „+250 ml“ im Widget – bucht sofort, ohne die App zu öffnen. */
class WaterAddReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == ACTION) WidgetStore.addWater(ctx, 250)
    }

    companion object {
        const val ACTION = "de.fitnessbuddy.app.WATER_ADD"
    }
}

@Suppress("unused")
private fun Double.r() = roundToInt()
