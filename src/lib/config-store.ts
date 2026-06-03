import { create } from "zustand";
import { temporal } from "zundo";
import { readAllConfigFiles, writeAllConfigFiles, reloadMango } from "./config-file";
import type { ConfigData, ConfigLine, SourceFile } from "./config-types";

// `data` is the merged view across all files (UI reads this).
// `files` is the authoritative source (written to disk).
// Mutations always go into `files`; `data` is re-derived.

function mergeFileData(files: SourceFile[]): ConfigData {
  const merged: ConfigData = {};
  for (const file of files) {
    for (const [key, values] of Object.entries(file.data)) {
      if (!merged[key]) merged[key] = [];
      merged[key].push(...values);
    }
  }
  return merged;
}

function fileIndexForKey(files: SourceFile[], key: string): number {
  const idx = files.findIndex((f) => key in f.data);
  return idx === -1 ? 0 : idx;
}

function resolveGlobalIndex(
  files: SourceFile[],
  key: string,
  globalIndex: number,
): { fileIdx: number; localIdx: number } | null {
  let seen = 0;
  for (let i = 0; i < files.length; i++) {
    const current = files[i].data[key];
    if (current) {
      if (seen + current.length > globalIndex) {
        return { fileIdx: i, localIdx: globalIndex - seen };
      }
      seen += current.length;
    }
  }
  return null;
}

function patchFile(
  files: SourceFile[],
  fileIdx: number,
  patchData: (prev: ConfigData) => ConfigData,
): SourceFile[] {
  return files.map((f, i) => (i === fileIdx ? { ...f, data: patchData(f.data) } : f));
}

function syncDerivedState() {
  const { files } = useConfigStore.getState();
  const { pastStates } = useConfigStore.temporal.getState();
  useConfigStore.setState({
    data: mergeFileData(files),
    dirty: pastStates.length > 0,
  });
}

interface ConfigStore {
  data: ConfigData; // merged — read by UI
  files: SourceFile[]; // per-file — written to disk
  loading: boolean;
  applying: boolean;
  dirty: boolean;
  error: string | null;

  load: () => Promise<void>;
  apply: () => Promise<void>;

  // Scalar upsert: sets exactly one value for a key.
  // Use for singletons (blur_radius, borderpx, …).
  setValue: (key: string, value: string) => void;
  // Atomic batch update for multiple scalar keys (one history entry).
  setValues: (entries: Record<string, string>) => void;

  // Multi-value list ops: use for keys where every line is a distinct entry
  // (bind=, exec-once=, env=, …).
  addEntry: (key: string, value: string) => void;
  /** Insert a new entry at a specific line position in a specific file.
   *  The new ConfigLine is spliced into `lines` at `afterLineIdx + 1` and
   *  its value is inserted at the corresponding index in `data[key]` so
   *  that serializeConfig emits it in the right order. */
  insertEntry: (key: string, value: string, options: { fileIdx: number; afterLineIdx: number }) => void;
  updateEntry: (key: string, index: number, value: string) => void;
  removeEntry: (key: string, index: number) => void;
}

export const useConfigStore = create<ConfigStore>()(
  temporal(
    (set, get) => ({
      data: {},
      files: [],
      loading: false,
      applying: false,
      dirty: false,
      error: null,

      load: async () => {
        set({ loading: true, error: null });
        try {
          const files = await readAllConfigFiles();
          set({ files, data: mergeFileData(files), loading: false, dirty: false });
          useConfigStore.temporal.getState().clear();
        } catch (e: unknown) {
          set({ error: String(e instanceof Error ? e.message : e), loading: false });
        }
      },

      apply: async () => {
        set({ applying: true, error: null });
        try {
          await writeAllConfigFiles(get().files);
          await reloadMango();
          set({ applying: false, dirty: false });
          useConfigStore.temporal.getState().clear();
        } catch (e: unknown) {
          set({ error: String(e instanceof Error ? e.message : e), applying: false });
        }
      },

      setValue: (key, value) =>
        set((state) => {
          const fileIdx = fileIndexForKey(state.files, key);
          const files = patchFile(state.files, fileIdx, (prev) => {
            const current = prev[key];
            if (current && current.length > 0) {
              const next = [...current];
              next[0] = value;
              return { ...prev, [key]: next };
            }
            return { ...prev, [key]: [value] };
          });
          return { files, data: mergeFileData(files), dirty: true };
        }),

      setValues: (entries) =>
        set((state) => {
          let files = state.files;
          for (const [key, value] of Object.entries(entries)) {
            const fileIdx = fileIndexForKey(files, key);
            files = patchFile(files, fileIdx, (prev) => {
              const current = prev[key];
              if (current && current.length > 0) {
                const next = [...current];
                next[0] = value;
                return { ...prev, [key]: next };
              }
              return { ...prev, [key]: [value] };
            });
          }
          return { files, data: mergeFileData(files), dirty: true };
        }),

      addEntry: (key, value) =>
        set((state) => {
          const fileIdx = fileIndexForKey(state.files, key);
          const files = patchFile(state.files, fileIdx, (prev) => ({
            ...prev,
            [key]: [...(prev[key] ?? []), value],
          }));
          return { files, data: mergeFileData(files), dirty: true };
        }),

      insertEntry: (key, value, { fileIdx, afterLineIdx }) =>
        set((state) => {
          const file = state.files[fileIdx];
          if (!file) return state;

          // 1. Insert new ConfigLine into lines at afterLineIdx + 1
          const newLine: ConfigLine = {
            type: "entry",
            key,
            value,
            raw: `${key} = ${value}`,
          };
          const newLines = [...file.lines];
          newLines.splice(afterLineIdx + 1, 0, newLine);

          // 2. Count how many values of this key appear before the
          //    insertion point in the updated lines array
          const insertPos = afterLineIdx + 1;
          let keyCount = 0;
          for (let i = 0; i < insertPos; i++) {
            const ln = newLines[i];
            if (ln.type === "entry" && ln.key === key) keyCount++;
          }

          // 3. Splice the value into data[key] at keyCount
          const current = file.data[key] ?? [];
          const newData = [...current];
          newData.splice(keyCount, 0, value);

          // 4. Patch the file
          const files = state.files.map((f, i) =>
            i === fileIdx
              ? { ...f, lines: newLines, data: { ...f.data, [key]: newData } }
              : f,
          );

          return { files, data: mergeFileData(files), dirty: true };
        }),

      updateEntry: (key, index, value) =>
        set((state) => {
          const target = resolveGlobalIndex(state.files, key, index);
          if (!target) return state;
          const files = patchFile(state.files, target.fileIdx, (prev) => {
            const current = prev[key] ?? [];
            const next = [...current];
            next[target.localIdx] = value;
            return { ...prev, [key]: next };
          });
          return { files, data: mergeFileData(files), dirty: true };
        }),

      removeEntry: (key, index) =>
        set((state) => {
          const target = resolveGlobalIndex(state.files, key, index);
          if (!target) return state;

          const files = state.files.map((f, i) => {
            if (i !== target.fileIdx) return f;

            // 1. Remove value from data at localIdx
            const current = f.data[key] ?? [];
            const next = current.filter((_, j) => j !== target.localIdx);
            let newData: ConfigData;
            if (next.length === 0) {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [key]: _dropped, ...rest } = f.data;
              newData = rest;
            } else {
              newData = { ...f.data, [key]: next };
            }

            // 2. Remove the corresponding entry line from lines so that
            //    serializeConfig doesn't have a ghost line that steals the
            //    value intended for a newly inserted entry (critical for
            //    keybinding mode-block placement).
            let lineCount = -1;
            const newLines = f.lines.filter((ln) => {
              if (ln.type === "entry" && ln.key === key) {
                lineCount++;
                return lineCount !== target.localIdx;
              }
              return true;
            });

            return { ...f, data: newData, lines: newLines };
          });

          return { files, data: mergeFileData(files), dirty: true };
        }),
    }),

    {
      partialize: (state) => ({ files: state.files }),
      limit: 100,
      equality: (a, b) => {
        const fa = a.files;
        const fb = b.files;
        return (
          fa.length === fb.length &&
          fa.every((f, i) => {
            const g = fb[i];
            return f.absPath === g.absPath && f.data === g.data;
          })
        );
      },
    },
  ),
);

export function undo() {
  useConfigStore.temporal.getState().undo();
  syncDerivedState();
}

export function redo() {
  useConfigStore.temporal.getState().redo();
  syncDerivedState();
}
