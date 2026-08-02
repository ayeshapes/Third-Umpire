/**
 * Wraps an API call so marketing/landing sections degrade gracefully
 * (rather than throwing a 500) if the backend or database isn't reachable
 * yet -- useful during local frontend-only development and for resilience
 * in production if a single query is slow/failing.
 */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
