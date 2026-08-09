import * as SecureStore from 'expo-secure-store';

export type EmailAppPreference = 'gmail' | 'outlook' | 'native_mail' | 'jobrunner' | 'ask';

const EMAIL_PREFERENCE_KEY = 'email_app_preference';

export async function getEmailPreference(): Promise<EmailAppPreference> {
  try {
    const preference = await SecureStore.getItemAsync(EMAIL_PREFERENCE_KEY);
    if (preference && ['gmail', 'outlook', 'native_mail', 'jobrunner', 'ask'].includes(preference)) {
      return preference as EmailAppPreference;
    }
    return 'ask';
  } catch (error) {
    if (__DEV__) console.warn('Failed to get email preference:', error);
    return 'ask';
  }
}

export async function setEmailPreference(preference: EmailAppPreference): Promise<void> {
  try {
    await SecureStore.setItemAsync(EMAIL_PREFERENCE_KEY, preference);
  } catch (error) {
    if (__DEV__) console.warn('Failed to save email preference:', error);
  }
}

export async function clearEmailPreference(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(EMAIL_PREFERENCE_KEY);
  } catch (error) {
    if (__DEV__) console.warn('Failed to clear email preference:', error);
  }
}

export function getEmailAppDisplayName(preference: EmailAppPreference): string {
  switch (preference) {
    case 'gmail':
      return 'Gmail';
    case 'outlook':
      return 'Outlook';
    case 'native_mail':
      return 'Default Mail App';
    case 'jobrunner':
      return 'JobRunner';
    case 'ask':
    default:
      return 'Ask each time';
  }
}
