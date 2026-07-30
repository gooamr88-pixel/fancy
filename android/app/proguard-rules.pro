# R8 rules for the check-in app.
#
# Two things here are correctness-critical rather than optimisation hygiene:
#
#   1. kotlinx.serialization relies on generated serializers reachable by name.
#      Stripping them makes every API response fail to parse in RELEASE only —
#      the build succeeds, the debug variant works, and the release APK cannot
#      talk to the server. That is the worst possible place to discover it.
#
#   2. Room and SQLCipher load native/generated classes reflectively.

# ── kotlinx.serialization ──
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep every @Serializable model and its generated serializer.
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1>$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class com.fancyrsvp.checkin.data.remote.**$$serializer { *; }
-keepclassmembers class com.fancyrsvp.checkin.data.remote.** {
    *** Companion;
}

# ── Retrofit / OkHttp ──
-keepattributes Signature, Exceptions
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ── Room ──
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-dontwarn androidx.room.paging.**

# ── SQLCipher ──
-keep class net.zetetic.database.** { *; }
-dontwarn net.zetetic.database.**

# ── ML Kit barcode (bundled model) ──
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ── Log hygiene (§20.7) ──
# Verbose and debug logging must be absent from release builds. Guest names must
# never reach a log statement in any variant, but this removes the calls outright
# so a future mistake cannot leak through one.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
}
