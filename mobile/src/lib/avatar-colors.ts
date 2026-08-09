const AVATAR_COLORS: { bg: string; fg: string }[] = [
  { bg: '#5B8DEF', fg: '#ffffff' },
  { bg: '#43B882', fg: '#ffffff' },
  { bg: '#E87461', fg: '#ffffff' },
  { bg: '#9B7BDB', fg: '#ffffff' },
  { bg: '#E8739C', fg: '#ffffff' },
  { bg: '#4DBECD', fg: '#ffffff' },
  { bg: '#E49E5C', fg: '#ffffff' },
  { bg: '#6C8FBF', fg: '#ffffff' },
  { bg: '#C75B8F', fg: '#ffffff' },
  { bg: '#5BAF7E', fg: '#ffffff' },
  { bg: '#7E8FC7', fg: '#ffffff' },
  { bg: '#D4766B', fg: '#ffffff' },
  { bg: '#5AADAA', fg: '#ffffff' },
  { bg: '#BD7BBE', fg: '#ffffff' },
  { bg: '#6BA3D6', fg: '#ffffff' },
  { bg: '#D68A6E', fg: '#ffffff' },
  { bg: '#7B9E57', fg: '#ffffff' },
  { bg: '#C78B5E', fg: '#ffffff' },
  { bg: '#8E85C2', fg: '#ffffff' },
  { bg: '#55B5A6', fg: '#ffffff' },
];

export const AVATAR_PALETTE_HEX = AVATAR_COLORS.map(c => c.bg);

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getAvatarColor(nameOrId: string): { bg: string; fg: string } {
  if (!nameOrId) return AVATAR_COLORS[0];
  return AVATAR_COLORS[stableHash(nameOrId) % AVATAR_COLORS.length];
}

export function getAvatarColorByHex(hex: string | null | undefined, fallbackNameOrId?: string): { bg: string; fg: string } {
  if (hex && hex.startsWith('#')) {
    return { bg: hex, fg: '#ffffff' };
  }
  if (fallbackNameOrId) return getAvatarColor(fallbackNameOrId);
  return AVATAR_COLORS[0];
}

export function getAvatarColorById(userId: string, fallbackName?: string): { bg: string; fg: string } {
  if (userId) return AVATAR_COLORS[stableHash(userId) % AVATAR_COLORS.length];
  if (fallbackName) return getAvatarColor(fallbackName);
  return AVATAR_COLORS[0];
}

export function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.substring(0, 2).toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return '??';
}
