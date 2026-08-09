import { Platform } from 'react-native';

import LiveActivityModule from './LiveActivityModule';

// JobStatus values mirror the Swift `JobStatus` enum in
// mobile/targets/JobRunnerLiveActivity/JobRunnerLiveActivityAttributes.swift —
// the raw string values cross the bridge, so keep them in sync.
export type JobStatus = 'in_progress' | 'on_break' | 'completed';

// Fields the JS side sends to start an activity. The native side fills in
// `startedAt = Date()` itself; clients don't pass a timestamp.
export type LiveActivityJob = {
  id: string;
  address: string;
  clientName: string;
};

export type LiveActivityNativeModule = {
  areActivitiesEnabled(): Promise<boolean>;
  start(job: LiveActivityJob): Promise<string>;
  update(status: JobStatus): Promise<void>;
  end(): Promise<void>;
};

const isIOS = Platform.OS === 'ios';

// Public API. Non-iOS platforms get no-ops so callers can invoke these
// unconditionally — Live Activities are an iOS-only feature.
export async function areActivitiesEnabled(): Promise<boolean> {
  if (!isIOS) return false;
  return LiveActivityModule.areActivitiesEnabled();
}

export async function start(job: LiveActivityJob): Promise<string | null> {
  if (!isIOS) return null;
  return LiveActivityModule.start(job);
}

export async function update(status: JobStatus): Promise<void> {
  if (!isIOS) return;
  return LiveActivityModule.update(status);
}

export async function end(): Promise<void> {
  if (!isIOS) return;
  return LiveActivityModule.end();
}

export default {
  areActivitiesEnabled,
  start,
  update,
  end,
};
