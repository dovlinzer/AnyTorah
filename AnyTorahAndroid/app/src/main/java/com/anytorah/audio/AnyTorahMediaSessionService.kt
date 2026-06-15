package com.anytorah.audio

import androidx.media3.session.MediaSessionService

/**
 * Minimal MediaSessionService stub required by the AndroidManifest to support
 * background audio playback and media notification controls.
 * ExoPlayer is managed by AudioPlayer in the activity; this service class satisfies
 * the manifest declaration for foreground service type "mediaPlayback".
 */
class AnyTorahMediaSessionService : MediaSessionService() {
    override fun onGetSession(controllerInfo: androidx.media3.session.MediaSession.ControllerInfo) = null
}
