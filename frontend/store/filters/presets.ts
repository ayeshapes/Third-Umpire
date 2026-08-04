/**
 * Ticket 6.9 -- Saved Filter Presets.
 *
 * Pure storage layer -- no React here on purpose, same split as
 * ./url.ts (framework-agnostic helpers, easy to unit test; the React
 * glue lives in hooks/use-filter-presets.ts).
 *
 * Storage: browser localStorage only ("Store locally" per the ticket
 * -- no backend endpoint). Two independent keys:
 *
 *   thirdumpire:filter-presets   FilterPreset[]   explicit Save
 *   thirdumpire:recent-filters   RecentFilterEntry[]   auto-tracked
 *
 * Both are namespaced under "thirdumpire:" to avoid collisions with
 * anything else the app later puts in localStorage, and both fail soft:
 * a corrupt/blocked localStorage (private browsing, quota, disabled
 * storage) degrades to "no presets/history" rather than throwing and
 * breaking the filter bar.
 */

import { DEFAULT_FILTERS, FILTER_LABELS } from "./constants";
import type { FilterKey, FilterState } from "./types";

const PRESETS_KEY = "thirdumpire:filter-presets";
const RECENTS_KEY = "thirdumpire:recent-filters";

/** Recently-used list is capped so it stays "recent", not an ever-growing log. */
export const MAX_RECENT_FILTERS = 8;

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface RecentFilterEntry {
  id: string;
  filters: FilterState;
  /** When this combination was last applied -- used to keep the list sorted most-recent-first and to dedupe. */
  usedAt: string; // ISO timestamp
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    // Corrupt JSON or storage access denied -- degrade to empty rather than throw.
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded / storage disabled -- caller decides how to surface this.
    return false;
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** True if `filters` has nothing set away from defaults -- not worth saving/tracking. */
export function isEmptyFilterState(filters: FilterState): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).every((key) => filters[key] === DEFAULT_FILTERS[key]);
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export function loadPresets(): FilterPreset[] {
  return readJson<FilterPreset[]>(PRESETS_KEY, []);
}

export interface SavePresetResult {
  ok: boolean;
  preset?: FilterPreset;
  error?: string;
}

/**
 * Save the current filters as a new named preset. Names are
 * case-insensitively unique -- saving over an existing name updates
 * that preset in place (same id, refreshed `updatedAt`) instead of
 * creating a duplicate.
 */
export function savePreset(name: string, filters: FilterState): SavePresetResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the preset a name first." };
  if (isEmptyFilterState(filters)) return { ok: false, error: "Set at least one filter before saving a preset." };

  const presets = loadPresets();
  const now = new Date().toISOString();
  const existing = presets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  let next: FilterPreset[];
  let saved: FilterPreset;
  if (existing) {
    saved = { ...existing, filters, updatedAt: now };
    next = presets.map((p) => (p.id === existing.id ? saved : p));
  } else {
    saved = { id: makeId(), name: trimmed, filters, createdAt: now, updatedAt: now };
    next = [...presets, saved];
  }

  if (!writeJson(PRESETS_KEY, next)) {
    return { ok: false, error: "Couldn't save the preset -- local storage is unavailable." };
  }
  return { ok: true, preset: saved };
}

export interface RenamePresetResult {
  ok: boolean;
  error?: string;
}

export function renamePreset(id: string, newName: string): RenamePresetResult {
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, error: "Name can't be empty." };

  const presets = loadPresets();
  const target = presets.find((p) => p.id === id);
  if (!target) return { ok: false, error: "Preset not found." };

  const clashes = presets.some((p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase());
  if (clashes) return { ok: false, error: "A preset with that name already exists." };

  const next = presets.map((p) => (p.id === id ? { ...p, name: trimmed, updatedAt: new Date().toISOString() } : p));
  if (!writeJson(PRESETS_KEY, next)) return { ok: false, error: "Couldn't rename the preset -- local storage is unavailable." };
  return { ok: true };
}

export function deletePreset(id: string): boolean {
  const presets = loadPresets();
  const next = presets.filter((p) => p.id !== id);
  if (next.length === presets.length) return false; // nothing to delete
  return writeJson(PRESETS_KEY, next);
}

/* ------------------------------------------------------------------ */
/* Recently used filters                                               */
/* ------------------------------------------------------------------ */

export function loadRecentFilters(): RecentFilterEntry[] {
  return readJson<RecentFilterEntry[]>(RECENTS_KEY, []);
}

/**
 * Record `filters` as the most-recently-used combination. Call this
 * when the user *applies* a meaningful filter change (see
 * hooks/use-filter-presets.ts for the debounced call site) -- not on
 * every keystroke.
 *
 * Dedupes by exact filter contents (an identical combination just
 * moves to the front with a fresh timestamp instead of appearing
 * twice) and caps the list at MAX_RECENT_FILTERS.
 */
export function pushRecentFilters(filters: FilterState): RecentFilterEntry[] {
  if (isEmptyFilterState(filters)) return loadRecentFilters();

  const existing = loadRecentFilters();
  const serialized = JSON.stringify(filters);
  const withoutDupe = existing.filter((entry) => JSON.stringify(entry.filters) !== serialized);

  const entry: RecentFilterEntry = { id: makeId(), filters, usedAt: new Date().toISOString() };
  const next = [entry, ...withoutDupe].slice(0, MAX_RECENT_FILTERS);

  writeJson(RECENTS_KEY, next);
  return next;
}

export function clearRecentFilters(): boolean {
  return writeJson(RECENTS_KEY, []);
}

/**
 * Short human-readable summary of a filter combination, e.g.
 * "Season: 2024 · Team: Lahore Qalandars · +3 more" -- used to label
 * saved presets and recently-used entries without a huge JSON dump.
 */
export function summarizeFilters(filters: FilterState, maxParts = 3): string {
  const active = (Object.keys(DEFAULT_FILTERS) as FilterKey[]).filter(
    (key) => filters[key] !== DEFAULT_FILTERS[key]
  );
  if (active.length === 0) return "No filters set";

  const parts = active.slice(0, maxParts).map((key) => `${FILTER_LABELS[key]}: ${filters[key]}`);
  const remainder = active.length - parts.length;
  return remainder > 0 ? `${parts.join(" · ")} · +${remainder} more` : parts.join(" · ");
}
