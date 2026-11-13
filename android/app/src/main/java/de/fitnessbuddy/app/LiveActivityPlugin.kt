package de.fitnessbuddy.app

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Laufende Benachrichtigung mit Countdown – sichtbar auf dem Sperrbildschirm
 * (Satzpause, Fasten). Android zählt selbst herunter, die App muss nicht laufen.
 */
@CapacitorPlugin(name = "LiveActivity")
class LiveActivityPlugin : Plugin() {
    private fun idOf(kind: String) = when (kind) {
        "rest" -> 8101
        "fasting" -> 8102
        else -> 8103
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val kind = call.getString("kind") ?: "workout"
        val nm = NotificationManagerCompat.from(context)
        if (!nm.areNotificationsEnabled()) return call.resolve()

        val path = if (kind == "fasting") "/nutrition" else "/"
        val open = PendingIntent.getActivity(
            context,
            idOf(kind),
            Intent(Intent.ACTION_VIEW, Uri.parse("fitnessbuddy://open$path"), context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val b = NotificationCompat.Builder(context, Channels.LIVE)
            .setSmallIcon(R.drawable.ic_stat_buddy)
            .setColor(0xFFE11D48.toInt())
            .setContentTitle(call.getString("title") ?: "")
            .setContentText(call.getString("body") ?: "")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(if (kind == "rest") NotificationCompat.CATEGORY_STOPWATCH else NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open)
            // Android 16: als „Live-Update“ oben in der Statusleiste und auf dem Sperrbildschirm hervorheben
            .setRequestPromotedOngoing(true)

        val endsAt = call.getLong("endsAt")
        val startedAt = call.getLong("startedAt")
        if (endsAt != null) {
            b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(endsAt).setShowWhen(true)
            b.setTimeoutAfter((endsAt - System.currentTimeMillis()).coerceAtLeast(1000) + 2000)
        } else if (startedAt != null) {
            b.setUsesChronometer(true).setWhen(startedAt).setShowWhen(true)
        }
        call.getDouble("progress")?.let { b.setProgress(1000, (it * 1000).toInt().coerceIn(0, 1000), false) }

        try {
            nm.notify(idOf(kind), b.build())
        } catch (_: SecurityException) {
            // Benachrichtigungen nicht erlaubt – stillschweigend ignorieren
        }
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        NotificationManagerCompat.from(context).cancel(idOf(call.getString("kind") ?: "workout"))
        call.resolve()
    }

    /**
     * Ist Firebase eingerichtet (google-services.json beim Bauen vorhanden)? Ohne würde das
     * Push-Plugin beim Registrieren abstürzen – die App fragt deshalb vorher hier nach.
     */
    @PluginMethod
    fun pushReady(call: PluginCall) {
        val id = context.resources.getIdentifier("google_app_id", "string", context.packageName)
        call.resolve(com.getcapacitor.JSObject().put("ready", id != 0))
    }
}
