package app.bookwithai.app.wear

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
 * Appointment Detail. Read-only fields (customer, service, start time,
 * duration, assigned professional) plus, new in P5: Start, Complete, and
 * Open on Phone. Start/Complete are requested from the paired, already-
 * authenticated phone app over the Wearable Data Layer bridge (see
 * MessageSender/WearBridgeModule) -- this screen never calls Book With AI's
 * API itself and never performs checkout/payment.
 */
@Composable
fun AppointmentDetailScreen(appointmentId: String) {
    val context = LocalContext.current
    val schedule by WearDataRepository.schedule.collectAsState()
    val actionResult by WearDataRepository.actionResult.collectAsState()
    val appointment = schedule?.today?.firstOrNull { it.id == appointmentId }
        ?: schedule?.next?.takeIf { it.id == appointmentId }

    var pendingAction by remember(appointmentId) { mutableStateOf<String?>(null) }
    var statusText by remember(appointmentId) { mutableStateOf<String?>(null) }

    fun runAction(action: String) {
        if (pendingAction != null) return // avoid duplicate taps while pending
        pendingAction = action
        statusText = if (action == "start") "Starting…" else "Completing…"
        WearDataRepository.clearActionResult()
        MessageSender.requestAction(context, action, appointmentId)
    }

    LaunchedEffect(pendingAction) {
        val action = pendingAction ?: return@LaunchedEffect
        val result = withTimeoutOrNull(ACTION_TIMEOUT_MS) {
            var value = WearDataRepository.actionResult.value
            while (value == null || value.bookingId != appointmentId || value.action != action) {
                delay(200)
                value = WearDataRepository.actionResult.value
            }
            value
        }
        statusText = when {
            result == null -> "Couldn't reach your phone"
            result.success -> if (action == "start") "Started" else "Completed"
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
                text = appointment.customerName,
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

        val time = formatWearTime(appointment.startsAtIso)
        if (time != null) {
            item {
                Text(
                    text = time,
                    color = MaterialTheme.colors.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        val duration = formatWearDuration(appointment.startsAtIso, appointment.endsAtIso)
        if (duration != null) {
            item {
                Text(
                    text = duration,
                    style = MaterialTheme.typography.caption1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        if (!appointment.staffName.isNullOrBlank()) {
            item {
                Text(
                    text = "with ${appointment.staffName}",
                    style = MaterialTheme.typography.caption1,
                    color = MaterialTheme.colors.secondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
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
                onClick = { runAction("start") },
                label = { Text("Start") },
                enabled = pendingAction == null,
                colors = ChipDefaults.primaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { runAction("complete") },
                label = { Text("Complete") },
                enabled = pendingAction == null,
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Chip(
                onClick = { RemoteOpener.openAppointmentOnPhone(context, appointmentId) },
                label = { Text("Open on Phone") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
