package de.fitnessbuddy.app.widgets

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** JS ↔ Widgets: Zahlen aktualisieren, im Widget getipptes Wasser abholen. */
@CapacitorPlugin(name = "AppWidgets")
class AppWidgetsPlugin : Plugin() {
    @PluginMethod
    fun update(call: PluginCall) {
        val json = call.getString("snapshot") ?: return call.reject("snapshot fehlt")
        WidgetStore.saveSnapshot(context, json)
        call.resolve()
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
