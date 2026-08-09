import { Alert } from '@/lib/alert';
import * as ImagePicker from 'expo-image-picker';
import { API_URL, api } from './api';

export type AttachmentSource = 'camera' | 'library';

export type PickedAsset = {
  uri: string;
  fileName: string;
  mimeType: string;
};

export async function pickChatAttachment(source: AttachmentSource): Promise<PickedAsset | null> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take a photo.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      fileName: asset.fileName || `photo_${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission required', 'Photo library access is needed to attach an image.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName || `image_${Date.now()}.jpg`,
    mimeType: asset.mimeType || 'image/jpeg',
  };
}

// Show a Camera / Library / Cancel chooser, then pick.
export function promptForAttachment(): Promise<PickedAsset | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Attach a photo',
      undefined,
      [
        { text: 'Take Photo', onPress: async () => resolve(await pickChatAttachment('camera')) },
        { text: 'Choose from Library', onPress: async () => resolve(await pickChatAttachment('library')) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

// Multipart upload to a chat attachment endpoint. Returns the created message JSON.
export async function uploadChatAttachment(
  uploadPath: string,
  asset: PickedAsset,
  extraFields: Record<string, string> = {},
): Promise<any> {
  const token = await api.getToken();
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName,
    type: asset.mimeType,
  } as any);
  for (const [k, v] of Object.entries(extraFields)) {
    formData.append(k, v);
  }
  const res = await fetch(`${API_URL}${uploadPath}`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'x-mobile-app': 'true',
    },
    body: formData,
  });
  if (!res.ok) {
    let errMsg = 'Upload failed';
    try {
      const err = await res.json();
      errMsg = err.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

// Resolve a server-relative `/objects/...` path into a full URL the <Image> tag can load.
export function resolveAttachmentUrl(attachmentUrl: string | null | undefined): string | null {
  if (!attachmentUrl) return null;
  if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) return attachmentUrl;
  return `${API_URL}${attachmentUrl.startsWith('/') ? '' : '/'}${attachmentUrl}`;
}
