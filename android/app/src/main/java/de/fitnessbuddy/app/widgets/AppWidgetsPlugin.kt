package de.fitnessbuddy.app.widgets

import android.content.ContentValues
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** JS ↔ Widgets: Zahlen aktualisieren, Buddy-Bild setzen, im Widget getipptes Wasser abholen. */
@CapacitorPlugin(name = "AppWidgets")
class AppWidgetsPlugin : Plugin() {
    @PluginMethod
    fun update(call: PluginCall) {
        val json = call.getString("snapshot") ?: return call.reject("snapshot fehlt")
        WidgetStore.saveSnapshot(context, json)
        call.resolve()
    }

    /** Gerendertes Maskottchen als Base64-PNG (ohne data:-Präfix), leer = entfernen. */
    @PluginMethod
    fun setBuddyImage(call: PluginCall) {
        val png = call.getString("png") ?: return call.reject("png fehlt")
        // Plugin-Aufrufe laufen schon im Hintergrund-Thread von Capacitor
        if (WidgetStore.saveBuddy(context, png)) call.resolve() else call.reject("Bild ungültig")
    }

    /**
     * Teilen-Bild (Base64-PNG ohne Präfix) in die Galerie legen (Bilder/Fitness). Ab Android 10 ohne
     * Berechtigung über MediaStore; ältere Geräte → reject, die App teilt dann stattdessen.
     */
    @PluginMethod
    fun saveImage(call: PluginCall) {
        val png = call.getString("png") ?: return call.reject("png fehlt")
        val name = call.getString("name") ?: "fitness-${System.currentTimeMillis()}.png"
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return call.reject("zu alt")
        try {
            val bytes = Base64.decode(png, Base64.DEFAULT)
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Fitness")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                ?: return call.reject("kein Speicherplatz")
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return call.reject("schreiben fehlgeschlagen")
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            call.resolve()
        } catch (e: Exception) {
            call.reject("speichern fehlgeschlagen")
        }
    }

    @PluginMethod
    fun takePendingWater(call: PluginCall) {
        val p = WidgetStore.takePending(context)
        val list = JSArray()
        for (date in p.keys()) {
            list.put(JSObject().put("date", date).put("ml", p.optInt(date, 0)))
        }
        call.resolve(JSObject().put("entries", list))
    }
}
