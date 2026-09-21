package expo.modules.autofillbridge

import android.os.Build
import android.view.autofill.AutofillManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * React Native never tells Android "this form was just submitted" the way a
 * native Activity finishing (or a real <form> in a WebView) does, so
 * Android's usual "Save to Google Password Manager?" heuristics never fire
 * on their own after a JS-driven sign-in/sign-up navigation, even with the
 * right autofill hints on the fields themselves. AutofillManager.commit()
 * is the documented way to tell the framework directly: "the current
 * autofill session succeeded, offer to save what was entered."
 *
 * commit() is a fire-and-forget signal to the OS, not a data read -- it
 * never touches the actual email/password values, which stay exactly where
 * they already were (the OS's own autofill session, built from the fields'
 * autoComplete/textContentType hints). This module holds no credentials.
 */
class AutofillBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AutofillBridge")

    // Call right after a successful sign-in or account creation, once the
    // credential fields have been filled in and the screen is about to
    // navigate away.
    Function("commit") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val context = appContext.reactContext ?: return@Function false
      val afm = context.getSystemService(AutofillManager::class.java) ?: return@Function false
      afm.commit()
      true
    }
  }
}
