package app.bookwithai.app.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

/**
 * Today's Schedule -- a simple vertically scrollable Wear-native list, NOT
 * a recreation of the phone app's Day/3-Day/Week/Month calendar. One row
 * per appointment: time, customer, service. The next/upcoming appointment
 * is visually distinguished (primary chip colors + bold) from the rest.
 */
@Composable
fun ScheduleScreen(onOpenAppointment: (String) -> Unit) {
    val schedule by WearDataRepository.schedule.collectAsState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(
                text = "TODAY'S SCHEDULE",
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.secondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        val today = schedule?.today
        when {
            schedule == null -> item {
                Text(
                    text = "Waiting for data from your phone…",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            today.isNullOrEmpty() -> item {
                Text(
                    text = "No appointments today",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            else -> {
                val nextId = schedule?.next?.id
                items(today) { appt ->
                    val isNext = appt.id.isNotEmpty() && appt.id == nextId
                    Chip(
                        onClick = { onOpenAppointment(appt.id) },
                        label = {
                            Text(
                                appt.customerName,
                                fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal,
                            )
                        },
                        secondaryLabel = {
                            val time = formatWearTime(appt.startsAtIso) ?: "--:--"
                            Text("$time · ${appt.serviceName}")
                        },
                        colors = if (isNext) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}
