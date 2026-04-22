import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ─── Sound File Names ──────────────────────────────────────────────────────────
// These must match exactly what is registered in app.json → expo-notifications → sounds
// Android: stored in res/raw/ without extension
// iOS: stored in app bundle root
const SOUND_FILE_MP3 = 'notification.mp3';
const SOUND_FILE_WAV = 'notification.wav';

// ─── Android Notification Channels ────────────────────────────────────────────
export const CHANNEL_HIGH = 'priority_alerts_v2';   // P1–P3 tasks
export const CHANNEL_NORMAL = 'normal_alerts';       // P4–P7 tasks

/**
 * Register Android notification channels with custom sounds.
 * Must be called before scheduling any notifications.
 * On iOS this is a no-op (iOS uses per-notification sound config).
 */
export async function registerNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_HIGH, {
    name: 'Priority Alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: SOUND_FILE_MP3,          // ← custom sound for this channel
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#ef4444',
    enableVibrate: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync(CHANNEL_NORMAL, {
    name: 'Task Notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: SOUND_FILE_MP3,
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── Default Handler (foreground display behaviour) ───────────────────────────
/**
 * Call this once at app startup (e.g. in _layout.tsx or AppProvider).
 * Controls how notifications appear when the app is in the FOREGROUND.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,   // system will play the channel/notification sound
      shouldSetBadge: true,
    }),
  });
}



/**
 * Show a local notification immediately (foreground + background).
 * Uses expo-notifications — no extra packages needed.
 */
export async function playNotificationSound(
  title = '🔔 New Task Alert',
  body = 'A printer maintenance task needs attention.',
  isHigh = true
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,   // use channel sound on Android, default on iOS
        priority: isHigh
          ? Notifications.AndroidNotificationPriority.MAX
          : Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,  // fire immediately
      ...(Platform.OS === 'android' && {
        channelId: isHigh ? CHANNEL_HIGH : CHANNEL_NORMAL,
      }),
    });
    console.log('[Notifications] ✅ Local notification scheduled');
  } catch (err) {
    console.warn('[Notifications] ❌ Failed to schedule notification:', err);
  }
}

// ─── Push Token ───────────────────────────────────────────────────────────────
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push tokens only work on real devices.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission denied');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('[Notifications] Push Token:', token);
    return token;
  } catch (err) {
    console.warn('[Notifications] Could not get push token:', err);
    return null;
  }
}

// ─── Schedule a Local Notification ────────────────────────────────────────────
/**
 * Schedule an immediate local notification with the custom sound.
 * @param title  - Notification title
 * @param body   - Notification body
 * @param isHigh - true = high priority channel (P1–P3), false = normal channel
 */
export async function scheduleTaskNotification(
  title: string,
  body: string,
  isHigh = true
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: SOUND_FILE_MP3,    // iOS: plays this sound from app bundle
      priority: isHigh
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.DEFAULT,
      // Android uses the channel sound — the content sound is for iOS
      ...(Platform.OS === 'android' && {
        // 'categoryIdentifier' can be added here if needed
      }),
    },
    trigger: null,              // null = fire immediately
    ...(Platform.OS === 'android' && {
      channelId: isHigh ? CHANNEL_HIGH : CHANNEL_NORMAL,
    }),
  });
}