package app.bookwithai.app.wear

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.wear.remote.interactions.RemoteActivityHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * P5 -- "Open on Phone". Uses the standard, current AndroidX
 * RemoteActivityHelper (the modern replacement for the older
 * com.google.android.gms.wearable.RemoteIntent) to launch an activity on
 * the paired phone. Targets the phone app's own existing bookwithai://
 * Expo Router deep link (already registered by app.json's "scheme" and
 * already routing to src/app/appointment/[id].tsx) -- no new navigation
 * architecture on either side, just a remote launch of an existing link.
 */
object RemoteOpener {
    fun openAppointmentOnPhone(context: Context, appointmentId: String) {
        val intent = Intent(Intent.ACTION_VIEW)
            .setData(Uri.parse("bookwithai://appointment/$appointmentId"))
        val helper = RemoteActivityHelper(context)
        // startRemoteActivity returns a ListenableFuture<Void> -- blocking
        // .get() is safe here since this always runs on a background
        // (IO) dispatcher, not the main thread.
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { helper.startRemoteActivity(intent).get() }
        }
    }
}
