import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests permissions and returns the Expo push token.
 * Returns null if permissions are denied or if not on a physical device.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SupportA4 Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      // sound: 'notification.wav' — requires native rebuild via EAS Build;
      // uses Android default sound until then.
    });
  }


  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission for push notifications was denied.');
      return null;
    }
    
    try {
      // For Appwrite Messaging, we need the NATIVE device token (FCM/APNs)
      // instead of the Expo-proxied token.
      const deviceTokenRes = await Notifications.getDevicePushTokenAsync();
      token = deviceTokenRes.data;
      console.log("[Notifications] Native Device Token:", token);
    } catch (e) {
      console.error("[Notifications] Error fetching native device token:", e);
      return null;
    }
  } else {
    console.log('[Notifications] Push notifications require a physical device.');
    return null;
  }

  return token;
}
