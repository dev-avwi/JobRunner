export type UserRoleType = 'owner' | 'manager' | 'staff' | 'subcontractor' | 'solo_owner' | 'loading';

interface TeamMemberInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
  useCustomPermissions?: boolean;
  customPermissions?: string[];
  teamMemberId?: string;
}

interface CachedRoleData {
  role: UserRoleType;
  permissions: string[];
  teamMemberInfo: TeamMemberInfo | null;
  timestamp: number;
}

export const roleCache = new Map<string, CachedRoleData>();

export const fetchingUsers = new Set<string>();

// Session counter for stale fetch detection - incremented on cache clear/logout
let sessionCounter = 0;

export const getSessionCounter = () => sessionCounter;

// Clear cache and increment session counter (for logout/security scenarios)
export const clearRoleCache = () => {
  roleCache.clear();
  fetchingUsers.clear();
  sessionCounter++;
};

// Invalidate cache for a specific user (for permission refresh)
// Does NOT increment session counter - that happens when fetch starts
export const invalidateUserRoleCache = (userId: string) => {
  roleCache.delete(userId);
  fetchingUsers.delete(userId);
};

// Mark a user's cached role as stale WITHOUT removing it (stale-while-revalidate).
// Used by the foreground/periodic revalidation so the last-settled role stays
// readable during the background refetch. Deleting the entry (above) makes the
// role momentarily fall back to the owner/loading default, which flickers the
// owner "free" view for subcontractors before the real role reloads.
// Does NOT increment session counter - that happens when fetch starts.
export const markUserRoleCacheStale = (userId: string) => {
  const cached = roleCache.get(userId);
  if (cached) {
    roleCache.set(userId, { ...cached, timestamp: 0 });
  }
  fetchingUsers.delete(userId);
};

// Increment session counter when a new fetch cycle begins
// Returns the new session value to capture in the fetch
export const startNewFetchSession = () => {
  sessionCounter++;
  return sessionCounter;
};
