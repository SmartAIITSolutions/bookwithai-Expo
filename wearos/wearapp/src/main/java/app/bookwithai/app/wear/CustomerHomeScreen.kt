package app.bookwithai.app.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

/**
 * Customer Home -- a wrist glance, not a mini booking app. Shows only the
 * single next upcoming appointment (salon, service, date, time, countdown).
 * No salon discovery, no service browsing, no new-booking creation --
 * those stay on the phone. Tapping the appointment opens Customer
 * Appointment Detail.
 */
@Composable
fun CustomerHomeScreen(onOpenAppointment: (String) -> Unit) {
    val schedule by WearDataRepository.customerSchedule.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "BOOK WITH AI",
            style = MaterialTheme.typography.caption2,
            color = MaterialTheme.colors.secondary,
            textAlign = TextAlign.Center,
        )

        if (schedule == null) {
            Text(
                text = "Waiting for data from your phone…",
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp),
            )
            return@Column
        }

        val next = schedule?.next
        if (next == null) {
            Text(
                text = "No upcoming appointments",
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 12.dp),
            )
            return@Column
        }

        Text(
            text = next.salonName,
            style = MaterialTheme.typography.title3,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            text = next.serviceName,
            textAlign = TextAlign.Center,
        )
        val day = formatWearDayLabel(next.startsAtIso)
        val time = formatWearTime(next.startsAtIso)
        if (day != null && time != null) {
            Text(
                text = "$day • $time",
                color = MaterialTheme.colors.primary,
                textAlign = TextAlign.Center,
            )
        }
        val countdown = formatWearCountdown(next.startsAtIso, next.endsAtIso)
        if (countdown != null) {
            Text(
                text = countdown,
                style = MaterialTheme.typography.caption1,
                textAlign = TextAlign.Center,
            )
        }

        Chip(
            onClick = { onOpenAppointment(next.id) },
            label = { Text("View Appointment") },
            colors = ChipDefaults.secondaryChipColors(),
            modifier = Modifier.padding(top = 12.dp),
        )
    }
}
