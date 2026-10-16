package expo.modules.legacyprefs

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Reads the preferences written by the legacy Kotlin app (same package, so same data dir).
class LegacyPrefsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LegacyPrefs")

    Function("read") {
      val ctx = appContext.reactContext ?: return@Function null
      val defaults = ctx.getSharedPreferences("${ctx.packageName}_preferences", Context.MODE_PRIVATE)
      val state = ctx.getSharedPreferences("State", Context.MODE_PRIVATE) // Kotpref file name = object name
      if (defaults.all.isEmpty() && state.all.isEmpty()) return@Function null
      mapOf(
        "nightMode" to defaults.getString("NIGHTMODE", null),
        "fontSize" to defaults.getString("FONTSIZETOGGLE", null),
        "lastUrl" to state.getString("lastVisitedURL", null),
      )
    }
  }
}
