# Flutter Engine and Plugins
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.**  { *; }

# Flutter Secure Storage & AndroidX Security Crypto
-keep class androidx.security.crypto.** { *; }
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# Geolocator & Google Play Services Location
-keep class com.baseflow.geolocator.** { *; }
-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.common.** { *; }

# Preserve Annotations, Generic Signatures, and InnerClasses
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Suppress harmless warnings from optional dependencies
-dontwarn io.flutter.**
-dontwarn com.google.android.gms.**
-dontwarn androidx.security.crypto.**
