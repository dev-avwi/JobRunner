import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'pending_project_creation:v1:';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export interface PendingProjectCreation {
  userId: string;
  requestId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  postCreate?: {
    assignedToId?: string | null;
    assignedToIds?: string[];
    smsConversationId?: string | null;
  };
}

function isPendingProjectCreation(value: unknown): value is PendingProjectCreation {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PendingProjectCreation>;
  return (
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0 &&
    typeof candidate.requestId === 'string' &&
    candidate.requestId.length > 0 &&
    !!candidate.payload &&
    typeof candidate.payload === 'object' &&
    typeof candidate.createdAt === 'string'
  );
}

export async function persistPendingProjectCreation(
  pending: PendingProjectCreation,
): Promise<void> {
  await AsyncStorage.setItem(storageKey(pending.userId), JSON.stringify(pending));
}

export async function replayPendingProjectCreation<T>(
  pending: PendingProjectCreation,
  createProject: (payload: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  return createProject(pending.payload);
}

export async function getPendingProjectCreation(
  currentUserId: string,
): Promise<PendingProjectCreation | null> {
  const key = storageKey(currentUserId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isPendingProjectCreation(parsed)) {
      return parsed.userId === currentUserId ? parsed : null;
    }
  } catch {
    // Invalid state is removed below so it cannot block future project creation.
  }
  await AsyncStorage.removeItem(key);
  return null;
}

export async function clearPendingProjectCreation(
  userId: string,
  requestId: string,
): Promise<void> {
  const key = storageKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return;
  try {
    const current = JSON.parse(raw) as Partial<PendingProjectCreation>;
    if (current.requestId !== requestId) return;
    await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.removeItem(key);
  }
}