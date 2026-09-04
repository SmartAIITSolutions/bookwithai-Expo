package app.bookwithai.app.wear

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull

private const val ACTION_TIMEOUT_MS = 10_000L

/**
 * Customer Appointment Detail. Wrist-sized: salon, service, date/time,
 * status. Actions all request the paired, already-authenticated phone app
 * perform the existing API operation and report back -- this screen never
 * calls Book With AI's API itself, never reproduces cancellation/deposit/
 * cutoff rules, and never performs checkout/payment. Reschedule and "Open
 * in Book With AI" both hand off to the phone's existing appointment screen
 * (bookwithai://appointment/{id}), which already has its own Reschedule
 * affordance -- no time/service selection is built here.
 */
@Composable
fun CustomerAppointmentDetailScreen(appointmentId: String) {
    val context = LocalContext.current
    val schedule by WearDataRepository.customerSchedule.collectAsState()
    val actionResult by WearDataRepository.customerActionResult.collectAsState()
    val appointment = schedule?.next?.takeIf { it.id == appointmentId }

    var pendingAction by remember(appointmentId) { mutableStateOf<String?>(null) }
    var statusText by remember(appointmentId) { mutableStateOf<String?>(null) }

    fun runAction(action: String) {
        if (pendingAction != null) return // avoid duplicate taps while pending
        pendingAction = action
        statusText = when (action) {
            "arrived" -> "Checking in…"
            "eta_almost", "eta_late" -> "Notifying the salon…"
            else -> "Cancelling…"
        }
        WearDataRepository.clearCustomerActionResult()
        MessageSender.requestCustomerAction(context, action, appointmentId)
    }

    LaunchedEffect(pendingAction) {
        val action = pendingAction ?: return@LaunchedEffect
        val result = withTimeoutOrNull(ACTION_TIMEOUT_MS) {
            var value = WearDataRepository.customerActionResult.value
            while (value == null || value.bookingId != appointmentId || value.action != action) {
                delay(200)
                value = WearDataRepository.customerActionResult.value
            }
            value
        }
        statusText = when {
            result == null -> "Couldn't reach your phone"
            result.success && action == "arrived" -> "You're checked in"
            result.success && (action == "eta_almost" || action == "eta_late") -> "Salon notified"
            result.success && action == "cancel" -> "Appointment cancelled"
            // Server-enforced policy rejection (cutoff/deposit) surfaces here
            // verbatim from the existing cancel route -- never re-derived on
            // the watch.
            !result.success && action == "cancel" -> result.error ?: "Cancellation isn't available right now"
            else -> "Action couldn't be completed"
        }
        pendingAction = null
    }

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (appointment == null) {
            item {
                Text(
                    text = "Appointment not available",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            return@ScalingLazyColumn
        }

        item {
            Text(
                text = appointment.salonName,
                style = MaterialTheme.typography.title3,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Text(
                text = appointment.serviceName,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            val day = formatWearDayLabel(appointment.startsAtIso) ?: ""
            val time = formatWearTime(appointment.startsAtIso) ?: ""
            Text(
                text = "$day • $time",
                color = MaterialTheme.colors.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (statusText != null) {
            item {
                Text(
                    text = statusText ?: "",
                    style = MaterialTheme.typography.caption1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        item {
            Chip(
                onClick = { runAction("arrived") },
                label = { Text("I've Arrived") },
                enabled = pendingAction == null,
                colors = ChipDefaults.primaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { runAction("eta_almost") },
                label = { Text("Almost There") },
                enabled = pendingAction == null,
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { runAction("eta_late") },
                label = { Text("Running Late") },
                enabled = pendingAction == null,
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = {
                    val query = java.net.URLEncoder.encode(appointment.salonName, "UTF-8")
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$query"))
                    runCatching { context.startActivity(intent) }
                },
                label = { Text("Directions") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = {
                    RemoteOpener.openAppointmentOnPhone(context, appointmentId)
                },
                label = { Text("Reschedule") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { RemoteOpener.openAppointmentOnPhone(context, appointmentId) },
                label = { Text("Open in Book With AI") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { runAction("cancel") },
                label = { Text("Cancel Appointment") },
                enabled = pendingAction == null,
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
