"use client";

/**
 * Ticket 6.9 -- Saved Filter Presets.
 *
 * React glue around store/filters/presets.ts (pure localStorage
 * layer). Mirrors the split used for URL sync: the store module owns
 * read/write logic, this hook owns component state + effects.
 *
 * "Recently used filters" is tracked automatically: whenever the
 * shared filter store settles on a new *non-empty* combination (after
 * a short debounce, so we don't log a new entry per keystroke on a
 * range input), it's pushed to the front of the recents list.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFilters } from "@/store/filters";
import {
  deletePreset as deletePresetFromStorage,
  loadPresets,
  loadRecentFilters,
  pushRecentFilters,
  renamePreset as renamePresetInStorage,
  savePreset as savePresetToStorage,
  type FilterPreset,
  type RecentFilterEntry,
} from "@/store/filters/presets";

const RECENT_TRACK_DEBOUNCE_MS = 1200;

export interface UseFilterPresets {
  presets: FilterPreset[];
  recentFilters: RecentFilterEntry[];
  /** Save the current filter state as a new (or updated, if the name matches) preset. */
  save: (name: string) => { ok: boolean; error?: string };
  rename: (id: string, newName: string) => { ok: boolean; error?: string };
  remove: (id: string) => void;
  /** Apply a preset's (or a recent entry's) filters to the live filter store. */
  load: (filters: FilterPreset["filters"]) => void;
}

export function useFilterPresets(): UseFilterPresets {
  const { filters, setFilters } = useFilters();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [recentFilters, setRecentFilters] = useState<RecentFilterEntry[]>([]);

  // Hydrate from localStorage on mount only (SSR has no localStorage,
  // and other tabs writing concurrently isn't a case this app needs
  // to handle live -- presets/recents refresh on next mount/action).
  useEffect(() => {
    setPresets(loadPresets());
    setRecentFilters(loadRecentFilters());
  }, []);

  // Auto-track recently-used filter combinations, debounced so a
  // range slider being dragged doesn't spam the recents list with
  // every intermediate value.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      // Don't log whatever was already in the URL/store on first mount --
      // only combinations the user actively arrives at during this session.
      isFirstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRecentFilters(pushRecentFilters(filters));
    }, RECENT_TRACK_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters]);

  const save = useCallback(
    (name: string) => {
      const result = savePresetToStorage(name, filters);
      if (result.ok) setPresets(loadPresets());
      return { ok: result.ok, error: result.error };
    },
    [filters]
  );

  const rename = useCallback((id: string, newName: string) => {
    const result = renamePresetInStorage(id, newName);
    if (result.ok) setPresets(loadPresets());
    return result;
  }, []);

  const remove = useCallback((id: string) => {
    if (deletePresetFromStorage(id)) setPresets(loadPresets());
  }, []);

  const load = useCallback(
    (presetFilters: FilterPreset["filters"]) => {
      setFilters(presetFilters);
    },
    [setFilters]
  );

  return { presets, recentFilters, save, rename, remove, load };
}
