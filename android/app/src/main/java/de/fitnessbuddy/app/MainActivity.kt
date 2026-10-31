package de.fitnessbuddy.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import com.getcapacitor.BridgeActivity
import de.fitnessbuddy.app.widgets.AppWidgetsPlugin
import de.fitnessbuddy.app.widgets.WidgetStore

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Eigene Plugins vor super.onCreate registrieren
        registerPlugin(HealthBridgePlugin::class.java)
        registerPlugin(AppWidgetsPlugin::class.java)
        registerPlugin(LiveActivityPlugin::class.java)
        super.onCreate(savedInstanceState)
        createChannels()
    }

    /** Hell/Dunkel gewechselt: Widget-Bitmaps (Akzent-Schein) neu zeichnen. */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        WidgetStore.refreshAll(this)
    }

    /** Benachrichtigungs-Kanäle: einzeln in den Android-Einstellungen abschaltbar. */
    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(Channels.WORKOUT, "Training", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Pause vorbei, Training-Hinweise"
                enableVibration(true)
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(Channels.LIVE, "Live-Anzeige", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Satzpause und Fasten-Countdown auf dem Sperrbildschirm"
                setShowBadge(false)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            },
        )
        nm.createNotificationChannel(
            NotificationChannel(Channels.REMINDERS, "Erinnerungen", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Essen, Trinken, Training, Supplemente"
            },
        )
    }
}

object Channels {
    const val WORKOUT = "workout"
    const val LIVE = "live"
    const val REMINDERS = "reminders"
}
