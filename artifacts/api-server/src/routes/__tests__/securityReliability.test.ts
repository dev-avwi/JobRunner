import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStorage = vi.hoisted(() => ({
  getJob: vi.fn(),
  getJobAssignments: vi.fn(),
}));

vi.mock('../../storage', () => ({
  storage: mockStorage,
}));

import {
  PERMISSIONS,
  canAccessJobMedia,
  requireJobMediaAccess,
  type UserContext,
} from '../../permissions';

function context(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: 'worker-1',
    isOwner: false,
    effectiveUserId: 'owner-1',
    businessOwnerId: 'owner-1',
    permissions: [
      PERMISSIONS.READ_JOBS,
      PERMISSIONS.WRITE_JOB_MEDIA,
    ],
    teamMemberId: 'team-member-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getJob.mockResolvedValue({
    id: 'job-1',
    userId: 'owner-1',
    assignedTo: null,
  });
  mockStorage.getJobAssignments.mockResolvedValue([]);
});

describe('job document media boundary', () => {
  it('allows the owner without requiring an assignment lookup', async () => {
    const allowed = await canAccessJobMedia(context({
      userId: 'owner-1',
      isOwner: true,
      effectiveUserId: 'owner-1',
      businessOwnerId: null,
      permissions: Object.values(PERMISSIONS),
      teamMemberId: null,
    }), 'job-1');

    expect(allowed).toBe(true);
    expect(mockStorage.getJob).not.toHaveBeenCalled();
  });

  it('allows a true manager to oversee every job', async () => {
    const allowed = await canAccessJobMedia(context({
      roleName: 'Manager',
      permissions: [PERMISSIONS.VIEW_ALL, PERMISSIONS.MANAGE_TEAM],
    }), 'job-1');

    expect(allowed).toBe(true);
    expect(mockStorage.getJob).not.toHaveBeenCalled();
  });

  it('allows an assigned worker with media permission', async () => {
    mockStorage.getJob.mockResolvedValue({
      id: 'job-1',
      userId: 'owner-1',
      assignedTo: 'worker-1',
    });

    await expect(canAccessJobMedia(context({ roleName: 'Worker' }), 'job-1'))
      .resolves.toBe(true);
  });

  it('allows an assigned subcontractor with media permission', async () => {
    mockStorage.getJobAssignments.mockResolvedValue([{
      userId: 'subcontractor-1',
      teamMemberId: 'sub-team-member-1',
      isActive: true,
    }]);

    await expect(canAccessJobMedia(context({
      userId: 'subcontractor-1',
      teamMemberId: 'sub-team-member-1',
      roleName: 'Subcontractor',
      isSubcontractor: true,
    }), 'job-1')).resolves.toBe(true);
  });

  it('denies an unassigned worker even when the role can read jobs', async () => {
    await expect(canAccessJobMedia(context({ roleName: 'Worker' }), 'job-1'))
      .resolves.toBe(false);
  });

  it('denies a worker without a media permission even when assigned', async () => {
    mockStorage.getJob.mockResolvedValue({
      id: 'job-1',
      userId: 'owner-1',
      assignedTo: 'worker-1',
    });

    await expect(canAccessJobMedia(context({
      permissions: [PERMISSIONS.READ_JOBS],
    }), 'job-1')).resolves.toBe(false);
  });

  it('returns 403 before a project-document handler runs for an unassigned user', async () => {
    const req = {
      userId: 'worker-1',
      userContext: context({ roleName: 'Worker' }),
      params: { jobId: 'job-1' },
    };
    const state: { status?: number; body?: unknown } = {};
    const res = {
      status(code: number) {
        state.status = code;
        return this;
      },
      json(body: unknown) {
        state.body = body;
        return this;
      },
    };
    const next = vi.fn();

    await requireJobMediaAccess(req, res, next);

    expect(state.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
