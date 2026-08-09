import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { JobCollaborationCtxRaw } from '@/contexts/JobCollaborationContext';

interface JobEditor {
  userId: string;
  userName: string;
  joinedAt: number;
}

interface FieldUpdate {
  field: string;
  updatedBy: string;
  updatedByName: string;
  timestamp: number;
}

interface ConflictData {
  localChanges: Record<string, unknown>;
  serverData: Record<string, unknown>;
  changedFields: string[];
  serverVersion: number;
}

export function useJobCollaboration(jobId: string | undefined, currentUserId: string | undefined, userName?: string) {
  const ctx = useContext(JobCollaborationCtxRaw);
  const [editors, setEditors] = useState<JobEditor[]>([]);
  const [recentFieldUpdates, setRecentFieldUpdates] = useState<FieldUpdate[]>([]);
  const [conflict, setConflict] = useState<ConflictData | null>(null);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const fieldUpdateTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const otherEditors = editors.filter(e => e.userId !== currentUserId);

  const markFieldDirty = useCallback((field: string) => {
    dirtyFieldsRef.current.add(field);
  }, []);

  const clearDirtyFields = useCallback(() => {
    dirtyFieldsRef.current.clear();
  }, []);

  const handlePresenceEvent = useCallback((event: {
    jobId: string;
    editors: JobEditor[];
  }) => {
    if (event.jobId === jobId) {
      setEditors(event.editors);
    }
  }, [jobId]);

  const handleFieldUpdateEvent = useCallback((event: {
    jobId: string;
    updatedFields: string[];
    updatedBy: string;
    updatedByName: string;
    version: number;
    serverData: Record<string, unknown>;
    timestamp: number;
  }) => {
    if (event.jobId !== jobId) return;

    const newUpdates = event.updatedFields.map(field => ({
      field,
      updatedBy: event.updatedBy,
      updatedByName: event.updatedByName,
      timestamp: event.timestamp,
    }));

    setRecentFieldUpdates(prev => [...prev, ...newUpdates]);

    newUpdates.forEach(update => {
      const existingTimer = fieldUpdateTimers.current.get(update.field);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        setRecentFieldUpdates(prev => prev.filter(u => u.field !== update.field || u.timestamp !== update.timestamp));
        fieldUpdateTimers.current.delete(update.field);
      }, 5000);
      fieldUpdateTimers.current.set(update.field, timer);
    });
  }, [jobId]);

  const handleConflictResponse = useCallback((
    localChanges: Record<string, unknown>,
    serverData: Record<string, unknown>,
    serverVersion: number,
  ) => {
    const dirty = dirtyFieldsRef.current;
    const changedFields = Array.from(dirty).filter(k =>
      k !== 'version' && k !== 'updatedAt' &&
      JSON.stringify(localChanges[k]) !== JSON.stringify(serverData[k])
    );

    if (changedFields.length > 0) {
      setConflict({ localChanges, serverData, changedFields, serverVersion });
    }
  }, []);

  const resolveConflict = useCallback(() => {
    setConflict(null);
  }, []);

  const isFieldRecentlyUpdated = useCallback((field: string) => {
    return recentFieldUpdates.some(u => u.field === field);
  }, [recentFieldUpdates]);

  const getFieldUpdateInfo = useCallback((field: string) => {
    return recentFieldUpdates.find(u => u.field === field);
  }, [recentFieldUpdates]);

  useEffect(() => {
    if (!ctx || !jobId) return;
    if (userName) {
      ctx.sendEditingStart(jobId, userName);
    }
    const unsubPresence = ctx.onPresenceChange((evtJobId, evtEditors) => {
      if (evtJobId === jobId) {
        setEditors(evtEditors);
      }
    });
    const unsubFieldUpdate = ctx.onFieldUpdate((event) => {
      if (event.jobId === jobId) {
        handleFieldUpdateEvent(event);
      }
    });
    const unsubReconnect = ctx.onReconnect(() => {
      if (userName && jobId) {
        ctx.sendEditingStart(jobId, userName);
      }
    });
    return () => {
      unsubPresence();
      unsubFieldUpdate();
      unsubReconnect();
      if (jobId) ctx.sendEditingStop(jobId);
    };
  }, [ctx, jobId, userName, handleFieldUpdateEvent]);

  useEffect(() => {
    return () => {
      fieldUpdateTimers.current.forEach(timer => clearTimeout(timer));
      fieldUpdateTimers.current.clear();
    };
  }, []);

  return {
    otherEditors,
    recentFieldUpdates,
    conflict,
    markFieldDirty,
    clearDirtyFields,
    dirtyFieldsRef,
    handlePresenceEvent,
    handleFieldUpdateEvent,
    handleConflictResponse,
    resolveConflict,
    isFieldRecentlyUpdated,
    getFieldUpdateInfo,
  };
}
