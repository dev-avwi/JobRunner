import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const appBadge = {
  set: async (count: number) => {
    try {
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(count);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to set badge count:', error);
    }
  },
  
  clear: async () => {
    try {
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(0);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to clear badge count:', error);
    }
  },
  
  get: async (): Promise<number> => {
    try {
      if (Platform.OS === 'ios') {
        return await Notifications.getBadgeCountAsync();
      }
      return 0;
    } catch (error) {
      if (__DEV__) console.log('Failed to get badge count:', error);
      return 0;
    }
  },
  
  increment: async () => {
    try {
      if (Platform.OS === 'ios') {
        const current = await Notifications.getBadgeCountAsync();
        await Notifications.setBadgeCountAsync(current + 1);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to increment badge count:', error);
    }
  },
  
  decrement: async () => {
    try {
      if (Platform.OS === 'ios') {
        const current = await Notifications.getBadgeCountAsync();
        if (current > 0) {
          await Notifications.setBadgeCountAsync(current - 1);
        }
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to decrement badge count:', error);
    }
  },
};

export default appBadge;
