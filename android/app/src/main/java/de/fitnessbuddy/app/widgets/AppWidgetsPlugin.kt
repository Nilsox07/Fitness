package de.fitnessbuddy.app.widgets

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
