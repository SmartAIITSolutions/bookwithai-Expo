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
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

/**
 * Watch Home -- a wrist glance, not a mini dashboard. Shows only NEXT and
 * TODAY, with a single tap target into the full schedule. Read-only: no
 * Start/Complete/etc. in this phase.
 */
@Composable
fun HomeScreen(onOpenSchedule: () -> Unit, onOpenAppointment: (String) -> Unit) {
    val schedule by WearDataRepository.schedule.collectAsState()

    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(
                text = "BOOK WITH AI",
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.secondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (schedule == null) {
            item {
                Text(
                    text = "Waiting for data from your phone…",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            return@ScalingLazyColumn
        }

        val next = schedule?.next
        item {
            Text(
                text = "NEXT",
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        if (next == null) {
            item {
                Text(
                    text = "Nothing scheduled",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        } else {
            item {
                Chip(
                    onClick = { onOpenAppointment(next.id) },
                    label = { Text(next.customerName, fontWeight = FontWeight.Bold) },
                    secondaryLabel = {
                        val time = formatWearTime(next.startsAtIso)
                        val countdown = formatWearCountdown(next.startsAtIso, next.endsAtIso)
                        val line = listOfNotNull(next.serviceName, time, countdown).joinToString(" · ")
                        Text(line)
                    },
                    colors = ChipDefaults.primaryChipColors(),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        item {
            Text(
                text = "TODAY",
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            val count = schedule?.todayCount ?: 0
            Text(
                text = if (count == 0) "No appointments today" else "$count appointment${if (count == 1) "" else "s"}",
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            Chip(
                onClick = onOpenSchedule,
                label = { Text("View Schedule") },
                colors = ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
