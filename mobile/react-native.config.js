// Android payments go through Stripe web links, never Google Play Billing.
// Excluding react-native-iap from the Android build strips the bundled
// com.android.billingclient library entirely, which satisfies Google Play's
// "must use Billing Library 8.0.0+" requirement (the rule only applies to
// apps that ship the library). iOS keeps the module for Apple IAP.
module.exports = {
  dependencies: {
    'react-native-iap': {
      platforms: {
        android: null,
      },
    },
  },
};
