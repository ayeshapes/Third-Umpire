"use client";

/**
 * Ticket 6.9 -- Saved Filter Presets.
 *
 * Sits alongside <FilterBar> (see filter-state-demo/page.tsx). All
 * state comes from hooks/use-filter-presets.ts, which wraps the pure
 * localStorage layer in store/filters/presets.ts -- "Store locally"
 * per the ticket, no backend involved.
 *
 * Three sections:
 *   - Save: name the *current* filter combination and persist it.
 *   - Saved presets: Load / Rename / Delete each one.
 *   - Recently used: auto-tracked, most-recent-first, one-click Load
 *     (nothing to name or manage -- it's a shortcut, not a preset).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useFilters } from "@/store/filters";
import { summarizeFilters, type FilterPreset } from "@/store/filters/presets";
import { useFilterPresets } from "@/hooks/use-filter-presets";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function PresetRow({
  preset,
  onLoad,
  onRename,
  onDelete,
}: {
  preset: FilterPreset;
  onLoad: () => void;
  onRename: (newName: string) => { ok: boolean; error?: string };
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(preset.name);
  const [error, setError] = useState<string | null>(null);

  function commitRename() {
    const result = onRename(draftName);
    if (result.ok) {
      setIsEditing(false);
      setError(null);
    } else {
      setError(result.error ?? "Couldn't rename preset.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3">
      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setDraftName(preset.name);
                  setError(null);
                }
              }}
              className="h-8 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-crimson/30"
            />
            <Button size="sm" onClick={commitRename}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setDraftName(preset.name);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-ivory">{preset.name}</p>
            <p className="truncate text-xs text-fg-faint">{summarizeFilters(preset.filters)}</p>
          </>
        )}
        {error && <p className="mt-1 text-xs text-crimson-bright">{error}</p>}
      </div>

      {!isEditing && (
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={onLoad}>
            Load
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            Rename
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}

export function FilterPresets() {
  const { filters } = useFilters();
  const { presets, recentFilters, save, rename, remove, load } = useFilterPresets();
  const [nameDraft, setNameDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleSave() {
    const result = save(nameDraft);
    if (result.ok) {
      setNameDraft("");
      setSaveError(null);
    } else {
      setSaveError(result.error ?? "Couldn't save preset.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Save current filters */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-fg-faint">Save current filters</p>
        <div className="flex items-center gap-2">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={'Preset name, e.g. "2024 Playoffs"'}
            className="h-10 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-sm text-ivory placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-crimson/30"
          />
          <Button onClick={handleSave} disabled={!nameDraft.trim()}>
            Save preset
          </Button>
        </div>
        {saveError && <p className="mt-1.5 text-xs text-crimson-bright">{saveError}</p>}
        {!saveError && (
          <p className="mt-1.5 text-xs text-fg-faint">Currently: {summarizeFilters(filters)}</p>
        )}
      </div>

      {/* Saved presets */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-fg-faint">
          Saved presets {presets.length > 0 && `(${presets.length})`}
        </p>
        {presets.length === 0 ? (
          <p className="text-xs text-fg-faint">No saved presets yet -- name and save the filters above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {presets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                onLoad={() => load(preset.filters)}
                onRename={(newName) => rename(preset.id, newName)}
                onDelete={() => remove(preset.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recently used */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-fg-faint">Recently used</p>
        {recentFilters.length === 0 ? (
          <p className="text-xs text-fg-faint">Filter combinations you apply will show up here.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentFilters.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => load(entry.filters)}
                className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-2.5 text-left hover:border-crimson-bright/40"
              >
                <span className="truncate text-xs text-fg-muted">{summarizeFilters(entry.filters)}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-widest text-fg-faint">
                  {relativeTime(entry.usedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
