package com.anytorah.ui.screens

import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import coil.size.Size
import com.anytorah.api.TeshuvotPageManager
import kotlin.math.abs

/**
 * Displays a single Contemporary Teshuvot page image (Iggros Moshe, etc.) loaded from Google
 * Drive. Same pinch-to-zoom/pan/swipe mechanism as AnyDaf's PdfDafPageView.kt (a sibling app's
 * Talmud daf-image viewer) -- deliberately not shared as one library component, since the two
 * evolved from genuinely different call sites and projects; adapted here rather than forced
 * into a premature shared abstraction. iOS's equivalent (ContemporaryTeshuvotPageView.swift)
 * uses edge tap-zones instead of a swipe gesture for forward/back -- this Android version keeps
 * AnyDaf's proven swipe-at-1x-zoom pattern instead, since it's already validated on this
 * platform and Coil's gesture handling here has real per-platform quirks not worth
 * re-litigating for parity's sake alone.
 *
 * `onPrevious`/`onNext` receive no argument -- the caller (TextReaderScreen) is responsible for
 * mapping them to increment/decrement correctly, including respecting the reverseNavDirection
 * setting. This view only detects "swiped/tapped toward the start" vs "toward the end" of the
 * physical layout; it has no opinion on which direction that means semantically.
 */
@Composable
fun ContemporaryTeshuvotPageView(
    volume: String,
    page: Int,
    fg: Color,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val imageUrl = TeshuvotPageManager.imageUrl(context, volume, page)

    var scale by remember { mutableFloatStateOf(1f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    var offsetY by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(volume, page) {
        scale = 1f; offsetX = 0f; offsetY = 0f
    }

    if (imageUrl == null) {
        Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Text(
                "No image for page $page",
                style = MaterialTheme.typography.bodySmall,
                color = fg.copy(alpha = 0.6f)
            )
        }
        return
    }

    Box(modifier = modifier.fillMaxSize()) {
        SubcomposeAsyncImage(
            model = ImageRequest.Builder(context)
                .data(imageUrl)
                .size(Size.ORIGINAL)
                .build(),
            contentDescription = "Page $page",
            contentScale = ContentScale.Fit,
            alignment = Alignment.TopCenter,
            filterQuality = FilterQuality.High,
            loading = {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(32.dp), color = fg)
                }
            },
            error = {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Image unavailable", style = MaterialTheme.typography.bodySmall, color = fg)
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(volume, page) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        val newScale = (scale * zoom).coerceIn(1f, 6f)
                        scale = newScale
                        if (newScale > 1f) {
                            offsetX += pan.x
                            offsetY += pan.y
                        } else {
                            val dx = pan.x
                            if (abs(dx) > 40) {
                                if (dx < 0) onNext() else onPrevious()
                            }
                            offsetX = 0f
                            offsetY = 0f
                        }
                    }
                }
                .graphicsLayer(
                    scaleX = scale,
                    scaleY = scale,
                    translationX = offsetX,
                    translationY = offsetY
                )
        )
    }
}
