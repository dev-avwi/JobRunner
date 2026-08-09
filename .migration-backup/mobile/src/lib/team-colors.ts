import { useEffect, useState } from 'react';
import api from './api';
import { AVATAR_PALETTE_HEX } from './avatar-colors';

export interface MemberColor {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  themeColor: string;
  isOwner: boolean;
}

export type MemberColorMap = Record<string, MemberColor>;

let cache: MemberColor[] | null = null;

function toMap(list: MemberColor[]): MemberColorMap {
  const map: MemberColorMap = {};
  for (const m of list) map[m.userId] = m;
  return map;
}

async function fetchMemberColors(): Promise<MemberColor[]> {
  const res = await api.get<MemberColor[]>('/api/team/members/colors');
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Returns a map of userId -> member colour info for the current business.
 * Cached at module level so repeated mounts (chat, dispatch, avatars) don't refetch.
 * Pass refreshKey to force a refetch after a colour change.
 */
export function useTeamMemberColors(refreshKey?: number): MemberColorMap {
  const [map, setMap] = useState<MemberColorMap>(() => (cache ? toMap(cache) : {}));

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchMemberColors();
        cache = data;
        if (mounted) setMap(toMap(data));
      } catch {
        // leave whatever cache we have; colours fall back to hash
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  return map;
}

/** Clear the module cache (call after a colour change so other screens refetch). */
export function invalidateTeamColors() {
  cache = null;
}

/**
 * Resolve a stable colour for a user. Prefers the member's chosen themeColor,
 * otherwise falls back to a deterministic palette hash so unknown senders still
 * get a consistent colour.
 */
export function memberColorFor(map: MemberColorMap, userId?: string | null): string {
  if (userId && map[userId]?.themeColor) return map[userId].themeColor;
  if (userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    return AVATAR_PALETTE_HEX[Math.abs(hash) % AVATAR_PALETTE_HEX.length];
  }
  return AVATAR_PALETTE_HEX[0];
}
