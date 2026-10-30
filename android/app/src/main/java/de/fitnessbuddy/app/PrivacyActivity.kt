package de.fitnessbuddy.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/** Health Connect zeigt hierüber unsere Datenschutzerklärung an (Pflicht für den Zugriff). */
class PrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_URL)))
        finish()
    }

    companion object {
        const val PRIVACY_URL = "https://fitness-three-psi.vercel.app/datenschutz"
    }
}
