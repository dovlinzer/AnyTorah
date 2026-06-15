package com.anytorah.ui.panels

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anytorah.audio.AudioPlayer
import com.anytorah.ui.theme.LocalAnyTorahColors
import kotlin.math.roundToInt

@Composable
fun AudioPlayerPanel(
    audioPlayer: AudioPlayer,
    onPlay: () -> Unit,
    isAvailable: Boolean,
    isCheckingAvailability: Boolean,
    modifier: Modifier = Modifier
) {
    val colors = LocalAnyTorahColors.current

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(colors.cardBackground)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        // Progress bar (thin line above controls)
        if (!audioPlayer.isStopped && audioPlayer.duration > 0) {
            LinearProgressIndicator(
                progress = { (audioPlayer.currentTime / audioPlayer.duration).coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.dp)
                    .padding(bottom = 4.dp),
                color = colors.editorialColor,
                trackColor = colors.dividerColor
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            when {
                isCheckingAvailability -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = colors.editorialColor,
                        strokeWidth = 2.dp
                    )
                    Text(
                        "Checking audio…",
                        color = colors.secondaryText,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
                !isAvailable -> {
                    Text(
                        "No audio available",
                        color = colors.secondaryText,
                        fontSize = 12.sp
                    )
                }
                audioPlayer.isStopped -> {
                    // Idle: show Play button
                    TextButton(onClick = onPlay) {
                        Icon(
                            Icons.Default.PlayArrow,
                            contentDescription = "Play",
                            tint = colors.editorialColor,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            "Play",
                            color = colors.editorialColor,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                audioPlayer.isBuffering -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = colors.editorialColor,
                        strokeWidth = 2.dp
                    )
                    Text(
                        "Buffering…",
                        color = colors.secondaryText,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
                else -> {
                    // Active controls
                    Text(
                        text = formatTime(audioPlayer.currentTime),
                        color = colors.secondaryText,
                        fontSize = 11.sp,
                        modifier = Modifier.width(40.dp)
                    )

                    // Skip back 15s
                    IconButton(
                        onClick = { audioPlayer.skip(-15) },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            Icons.Default.FastRewind,
                            contentDescription = "Back 15s",
                            tint = colors.appForeground,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    // Play/Pause
                    IconButton(
                        onClick = { audioPlayer.togglePlayPause() },
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            if (audioPlayer.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (audioPlayer.isPlaying) "Pause" else "Play",
                            tint = colors.editorialColor,
                            modifier = Modifier.size(28.dp)
                        )
                    }

                    // Skip forward 15s
                    IconButton(
                        onClick = { audioPlayer.skip(15) },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            Icons.Default.FastForward,
                            contentDescription = "Forward 15s",
                            tint = colors.appForeground,
                            modifier = Modifier.size(22.dp)
                        )
                    }

                    // Stop
                    IconButton(
                        onClick = { audioPlayer.stop() },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            Icons.Default.Stop,
                            contentDescription = "Stop",
                            tint = colors.appForeground,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Speed picker
                    SpeedSelector(
                        currentRate = audioPlayer.playbackRate,
                        onRateSelected = { audioPlayer.setRate(it) }
                    )

                    Text(
                        text = formatTime(audioPlayer.duration),
                        color = colors.secondaryText,
                        fontSize = 11.sp,
                        modifier = Modifier.width(40.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun SpeedSelector(
    currentRate: Float,
    onRateSelected: (Float) -> Unit
) {
    val colors = LocalAnyTorahColors.current
    val speeds = listOf(0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)
    var expanded by remember { mutableStateOf(false) }
    val label = if (currentRate == 1f) "1×" else "${currentRate}×"

    TextButton(onClick = { expanded = !expanded }) {
        Text(label, color = colors.editorialColor, fontSize = 12.sp, fontWeight = FontWeight.Medium)
    }

    if (expanded) {
        androidx.compose.material3.DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            speeds.forEach { speed ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(if (speed == 1f) "1×" else "${speed}×") },
                    onClick = {
                        onRateSelected(speed)
                        expanded = false
                    }
                )
            }
        }
    }
}

private fun formatTime(seconds: Float): String {
    val totalSeconds = seconds.roundToInt()
    val m = totalSeconds / 60
    val s = totalSeconds % 60
    return "%d:%02d".format(m, s)
}
