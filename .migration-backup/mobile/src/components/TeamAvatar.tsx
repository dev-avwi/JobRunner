import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { getAvatarColor, getAvatarColorByHex } from '../lib/avatar-colors';
import { colors as staticColors } from '../lib/colors';

interface TeamAvatarProps {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  userId?: string;
  profileImageUrl?: string | null;
  themeColor?: string | null;
  size?: number;
}

function computeInitials(name?: string, firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (firstName) return firstName.substring(0, 2).toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return '??';
}

function getStableKey(userId?: string, name?: string, firstName?: string, lastName?: string, email?: string): string {
  if (userId && userId !== 'undefined' && userId !== 'null') return userId;
  if (firstName && lastName) return `${firstName.trim()} ${lastName.trim()}`;
  if (name && name.trim()) return name.trim();
  if (email) return email.trim();
  return '';
}

export function TeamAvatar({ name, firstName, lastName, email, userId, profileImageUrl, themeColor, size = 40 }: TeamAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = computeInitials(name, firstName, lastName, email);
  const stableKey = getStableKey(userId, name, firstName, lastName, email);

  const { bg } = themeColor
    ? getAvatarColorByHex(themeColor, stableKey)
    : getAvatarColor(stableKey);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  const fontSize = size < 28 ? 10 : size < 36 ? 12 : size < 48 ? 15 : 18;
  const validImageUrl = profileImageUrl && profileImageUrl.trim().length > 0 && !imageFailed;

  if (validImageUrl) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: profileImageUrl.trim() }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={{ color: staticColors.white, fontSize, fontWeight: '600', letterSpacing: 0.3 }}>
        {initials}
      </Text>
    </View>
  );
}
