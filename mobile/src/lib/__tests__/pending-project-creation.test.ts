jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPendingProjectCreation,
  getPendingProjectCreation,
  persistPendingProjectCreation,
  replayPendingProjectCreation,
} from '../pending-project-creation';

describe('pending project creation recovery', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persists the exact request ID and payload across module reads', async () => {
    await persistPendingProjectCreation({
      userId: 'user-1',
      requestId: 'request-1',
      payload: { clientGeneratedId: 'request-1', title: 'Recovered Project' },
      createdAt: '2026-08-19T00:00:00.000Z',
      postCreate: { assignedToId: 'worker-1' },
    });

    await expect(getPendingProjectCreation('user-1')).resolves.toEqual({
      userId: 'user-1',
      requestId: 'request-1',
      payload: { clientGeneratedId: 'request-1', title: 'Recovered Project' },
      createdAt: '2026-08-19T00:00:00.000Z',
      postCreate: { assignedToId: 'worker-1' },
    });
  });

  it('only clears the matching request', async () => {
    await persistPendingProjectCreation({
      userId: 'user-1',
      requestId: 'request-1',
      payload: { clientGeneratedId: 'request-1' },
      createdAt: '2026-08-19T00:00:00.000Z',
    });

    await clearPendingProjectCreation('user-1', 'another-request');
    expect((await getPendingProjectCreation('user-1'))?.requestId).toBe('request-1');

    await clearPendingProjectCreation('user-1', 'request-1');
    await expect(getPendingProjectCreation('user-1')).resolves.toBeNull();
  });

  it('does not expose one user’s pending payload to another signed-in user', async () => {
    await persistPendingProjectCreation({
      userId: 'user-1',
      requestId: 'request-1',
      payload: { clientGeneratedId: 'request-1' },
      createdAt: '2026-08-19T00:00:00.000Z',
    });

    await expect(getPendingProjectCreation('user-2')).resolves.toBeNull();
    expect((await getPendingProjectCreation('user-1'))?.requestId).toBe('request-1');
  });

  it('replays the exact saved request after a response-loss restart', async () => {
    const payload = {
      clientGeneratedId: 'request-1',
      title: 'Response Lost Project',
      initialProjectSetup: { phases: [{ clientId: 'phase-1', name: 'Build' }] },
    };
    await persistPendingProjectCreation({
      userId: 'user-1',
      requestId: 'request-1',
      payload,
      createdAt: '2026-08-19T00:00:00.000Z',
    });

    const restored = await getPendingProjectCreation('user-1');
    expect(restored).not.toBeNull();
    const createProject = jest.fn().mockResolvedValue({ data: { id: 'existing-project' } });

    const result = await replayPendingProjectCreation(restored!, createProject);

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(createProject).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ data: { id: 'existing-project' } });
  });

  it('removes malformed saved state instead of blocking creation', async () => {
    await AsyncStorage.setItem('pending_project_creation:v1:user-1', '{bad json');
    await expect(getPendingProjectCreation('user-1')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('pending_project_creation:v1:user-1')).resolves.toBeNull();
  });
});