import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    alert("Use a real device");
    return null;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert("Permission denied");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("Push Token:", token);

  return token;
}