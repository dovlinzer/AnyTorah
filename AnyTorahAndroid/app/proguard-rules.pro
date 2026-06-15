# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Bookmark model for Gson serialization
-keep class com.anytorah.models.Bookmark { *; }
-keep class com.anytorah.models.TextCategory { *; }

# Keep OkHttp
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }

# Keep Media3/ExoPlayer
-keep class androidx.media3.** { *; }
