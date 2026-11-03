package de.fitnessbuddy.app

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Spracheingabe über die System-Spracherkennung (Google-Dialog). Die Web-Spracherkennung
 * funktioniert im Android-WebView nicht. Braucht keine Mikrofon-Berechtigung der App.
 */
@CapacitorPlugin(name = "Speech")
class SpeechPlugin : Plugin() {
    private fun intent() = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "de-DE")
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "de-DE")
        putExtra(RecognizerIntent.EXTRA_PROMPT, "Was hast du gegessen?")
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }

    @PluginMethod
    fun available(call: PluginCall) {
        val ok = intent().resolveActivity(context.packageManager) != null
        call.resolve(JSObject().put("available", ok))
    }

    @PluginMethod
    fun listen(call: PluginCall) {
        val i = intent()
        if (call.getString("prompt") != null) i.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt"))
        if (i.resolveActivity(context.packageManager) == null) return call.reject("Keine Spracherkennung auf dem Gerät")
        try {
            startActivityForResult(call, i, "onResult")
        } catch (e: Exception) {
            call.reject("Spracherkennung ließ sich nicht starten")
        }
    }

    @ActivityCallback
    private fun onResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) return call.resolve(JSObject().put("text", ""))
        val text = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
            .orEmpty()
        call.resolve(JSObject().put("text", text))
    }
}
