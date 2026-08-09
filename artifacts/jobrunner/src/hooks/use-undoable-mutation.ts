import { useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { queryClient } from "@/lib/queryClient";
import * as React from "react";

const UNDO_DURATION_MS = 8000;

export interface UndoableMutationOptions<TVars> {
  /** Run when the action commits. In `eager` mode this fires immediately; in `deferred` mode after the undo window. */
  forward: (vars: TVars) => Promise<unknown>;
  /** In `eager` mode, run on Undo to invert the action (e.g. unarchive). Required for eager mode. */
  inverse?: (vars: TVars) => Promise<unknown>;
  /**
   * eager   — fire forward now, undo runs inverse (use for archive/unarchive).
   * deferred — wait `duration` ms before firing forward, undo cancels it (use for hard delete with no inverse).
   */
  mode?: "eager" | "deferred";
  /** Toast title shown after the action. */
  successTitle: (vars: TVars) => string;
  /** Optional supporting line under the title. */
  successDescription?: (vars: TVars) => string | undefined;
  /** Toast title shown after a successful undo. */
  undoTitle?: (vars: TVars) => string;
  /** Toast title shown if forward fails. */
  errorTitle?: (vars: TVars) => string;
  /** Query keys to invalidate after the action settles (forward success, inverse success, or deferred commit). */
  invalidateKeys?: readonly unknown[][];
  /** Override the undo window. Defaults to 8s. */
  duration?: number;
  /**
   * Optimistic cache patch for `deferred` mode. Receives the snapshot map of all queryKeys in `invalidateKeys`
   * before mutation. Returning `void` skips optimistic updates. The hook auto-rolls back on undo using the snapshot.
   */
  optimistic?: (vars: TVars) => void;
}

export interface UndoableMutationResult<TVars> {
  trigger: (vars: TVars) => void;
  /** True while the deferred timer is counting down or the inverse is pending. */
  isPending: boolean;
}

/**
 * Reusable Undo flow primitive.
 *
 * Two modes:
 * - eager    : forward fires immediately; Undo runs inverse. Fast UX, requires a true inverse mutation.
 * - deferred : forward is deferred for the undo window; Undo cancels it. Use when no inverse exists (hard delete).
 *
 * Toast shows for `duration` ms with an animated progress bar (see toast.tsx).
 */
export function useUndoableMutation<TVars>(opts: UndoableMutationOptions<TVars>): UndoableMutationResult<TVars> {
  const { toast, dismiss } = useToast();
  const mode = opts.mode ?? "eager";
  const duration = opts.duration ?? UNDO_DURATION_MS;
  const pendingRef = useRef(0);

  const invalidate = useCallback(() => {
    if (!opts.invalidateKeys) return;
    for (const key of opts.invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: key as any });
    }
  }, [opts.invalidateKeys]);

  const snapshotKeys = useCallback(() => {
    const map = new Map<unknown[], unknown>();
    if (!opts.invalidateKeys) return map;
    for (const key of opts.invalidateKeys) {
      map.set(key as unknown[], queryClient.getQueryData(key as any));
    }
    return map;
  }, [opts.invalidateKeys]);

  const restoreSnapshot = useCallback((map: Map<unknown[], unknown>) => {
    Array.from(map.entries()).forEach(([key, data]) => {
      queryClient.setQueryData(key as any, data);
    });
  }, []);

  const trigger = useCallback(
    (vars: TVars) => {
      pendingRef.current += 1;

      if (mode === "eager") {
        // Fire forward right away
        Promise.resolve(opts.forward(vars))
          .then(() => {
            invalidate();
          })
          .catch((err: any) => {
            toast({
              title: opts.errorTitle?.(vars) ?? "Action failed",
              description: err?.message || "Please try again",
              variant: "destructive",
            });
          })
          .finally(() => {
            pendingRef.current = Math.max(0, pendingRef.current - 1);
          });

        const t = toast({
          title: opts.successTitle(vars),
          description: opts.successDescription?.(vars),
          duration,
          showProgress: true,
          action: React.createElement(
            ToastAction,
            {
              altText: "Undo",
              onClick: () => {
                t.dismiss();
                if (!opts.inverse) return;
                Promise.resolve(opts.inverse(vars))
                  .then(() => {
                    invalidate();
                    toast({
                      title: opts.undoTitle?.(vars) ?? "Undone",
                      duration: 3000,
                    });
                  })
                  .catch((err: any) => {
                    toast({
                      title: "Undo failed",
                      description: err?.message || "Please try again",
                      variant: "destructive",
                    });
                  });
              },
            },
            "Undo",
          ) as any,
        });
        return;
      }

      // ---- deferred mode ----
      const snapshot = snapshotKeys();
      opts.optimistic?.(vars);

      let cancelled = false;
      const timer = window.setTimeout(async () => {
        if (cancelled) return;
        try {
          await opts.forward(vars);
          invalidate();
        } catch (err: any) {
          // Roll back optimistic update on failure
          restoreSnapshot(snapshot);
          toast({
            title: opts.errorTitle?.(vars) ?? "Action failed",
            description: err?.message || "Please try again",
            variant: "destructive",
          });
        } finally {
          pendingRef.current = Math.max(0, pendingRef.current - 1);
        }
      }, duration);

      const t = toast({
        title: opts.successTitle(vars),
        description: opts.successDescription?.(vars),
        duration,
        showProgress: true,
        action: React.createElement(
          ToastAction,
          {
            altText: "Undo",
            onClick: () => {
              cancelled = true;
              window.clearTimeout(timer);
              restoreSnapshot(snapshot);
              t.dismiss();
              toast({
                title: opts.undoTitle?.(vars) ?? "Undone",
                duration: 3000,
              });
              pendingRef.current = Math.max(0, pendingRef.current - 1);
            },
          },
          "Undo",
        ) as any,
      });
    },
    [mode, opts, invalidate, snapshotKeys, restoreSnapshot, toast, dismiss, duration],
  );

  return { trigger, isPending: pendingRef.current > 0 };
}
