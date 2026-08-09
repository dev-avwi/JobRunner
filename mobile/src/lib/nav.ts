import type { Href } from 'expo-router';

/**
 * Cast an arbitrary string (or template-string) path into expo-router's `Href`.
 *
 * expo-router's typed routes generate a literal-union of every static route in
 * the project. Routes that are added later, dynamic suffixes built at runtime,
 * or screens that live in feature-flagged folders aren't in that union and
 * trigger TS2345 at the call site even though navigation works at runtime.
 *
 * Use this helper as a single, greppable escape hatch instead of sprinkling
 * `as any` next to every `router.push(...)` call. When typed-routes regenerate
 * and a path becomes legal, the cast is a no-op.
 */
export function asHref(path: string): Href {
  return path as unknown as Href;
}
