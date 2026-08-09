# JobRunner Android Proguard rules
# Round 10 production hardening — keep classes referenced via reflection or
# native bridges that R8/Proguard would otherwise strip in release builds.

# Stripe Terminal SDK
-keep class com.stripe.stripeterminal.** { *; }
-keep interface com.stripe.stripeterminal.** { *; }
-dontwarn com.stripe.stripeterminal.**

# Sentry
-keep class io.sentry.** { *; }
-keep interface io.sentry.** { *; }
-dontwarn io.sentry.**

# Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-dontwarn com.swmansion.reanimated.**

# Hermes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.hermes.**

# OkHttp / Okio (used by RN networking & many SDKs)
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# gorhom/bottom-sheet (uses gesture handler internals via reflection)
-keep class com.gorhom.bottomsheet.** { *; }
-dontwarn com.gorhom.bottomsheet.**

# Expo modules
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }
-dontwarn expo.modules.**

# React Native core (be safe with bridge-invoked classes)
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-dontwarn com.facebook.react.**
