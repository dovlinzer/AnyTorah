package com.anytorah.audio

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.anytorah.api.TalmudAudioService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class AudioPlayer(private val context: Context) {

    var isPlaying by mutableStateOf(false)
    var isBuffering by mutableStateOf(false)
    var isStopped by mutableStateOf(true)
    var currentTime by mutableFloatStateOf(0f)
    var duration by mutableFloatStateOf(0f)
    var playbackRate by mutableFloatStateOf(1f)
    var nowPlayingTitle by mutableStateOf("")

    private var player: ExoPlayer? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var progressJob: Job? = null
    private var resolveJob: Job? = null

    // MARK: - Public API

    fun play(url: String, title: String = "") {
        stop()
        nowPlayingTitle = title
        isStopped = false
        isBuffering = true

        if (url.startsWith("soundcloud-track://")) {
            val trackId = url.removePrefix("soundcloud-track://")
            resolveJob = scope.launch {
                val resolved = TalmudAudioService.resolveSoundCloudUrl(trackId)
                if (resolved != null) {
                    startPlayback(resolved)
                } else {
                    isStopped = true
                    isBuffering = false
                }
            }
        } else {
            scope.launch { startPlayback(url) }
        }
    }

    fun stop() {
        resolveJob?.cancel()
        resolveJob = null
        progressJob?.cancel()
        progressJob = null

        player?.let {
            it.stop()
            it.release()
        }
        player = null

        isPlaying = false
        isBuffering = false
        isStopped = true
        currentTime = 0f
        duration = 0f
    }

    fun togglePlayPause() {
        val p = player ?: return
        if (isPlaying) {
            p.pause()
            isPlaying = false
        } else {
            p.play()
            isPlaying = true
        }
    }

    fun setRate(rate: Float) {
        playbackRate = rate
        player?.setPlaybackSpeed(rate)
    }

    fun skip(seconds: Int) {
        val p = player ?: return
        val newPos = (p.currentPosition + seconds * 1000L).coerceIn(0L, p.duration.coerceAtLeast(0L))
        p.seekTo(newPos)
        currentTime = newPos / 1000f
    }

    fun seek(fraction: Float) {
        val p = player ?: return
        if (p.duration > 0) {
            val newPos = (fraction * p.duration).toLong().coerceIn(0L, p.duration)
            p.seekTo(newPos)
            currentTime = newPos / 1000f
        }
    }

    // MARK: - Private

    private fun startPlayback(url: String) {
        val exo = ExoPlayer.Builder(context).build()
        player = exo

        exo.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> {
                        isBuffering = false
                        duration = exo.duration.coerceAtLeast(0L) / 1000f
                        if (!isStopped) {
                            exo.play()
                            exo.setPlaybackSpeed(playbackRate)
                            isPlaying = true
                            startProgressTracking()
                        }
                    }
                    Player.STATE_BUFFERING -> {
                        isBuffering = true
                    }
                    Player.STATE_ENDED -> {
                        isPlaying = false
                        isStopped = true
                        currentTime = 0f
                        progressJob?.cancel()
                    }
                    Player.STATE_IDLE -> {}
                }
            }

            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
        })

        exo.setMediaItem(MediaItem.fromUri(url))
        exo.prepare()
    }

    private fun startProgressTracking() {
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive) {
                val p = player
                if (p != null && p.isPlaying) {
                    currentTime = p.currentPosition / 1000f
                    val dur = p.duration
                    if (dur > 0) duration = dur / 1000f
                }
                delay(500)
            }
        }
    }

    fun release() {
        stop()
        scope.cancel()
    }
}
