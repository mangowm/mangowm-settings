/**
 * key-recorder.ts
 *
 * Shared hook for keyboard key capturing, used by both:
 *   - The dialog's key capture section (BindingFormDialog)
 *
 * The hook manages the recording state machine (idle → recording → captured)
 * and provides a common event handler that translates raw KeyboardEvents
 * into CapturedCombo objects using the single jsKeyToXkb() mapping.
 *
 * Usage (inline, capture-all):
 *   const recorder = useKeyRecorder((combo) => setCombo(combo));
 *   <input onKeyDown={recorder.handleKeyDown} />
 *   // combo includes modifiers from the event: {key, ctrl, alt, shift, super}
 *
 * Usage (dialog, key-only):
 *   const recorder = useKeyRecorder((combo) => setKey(combo.key));
 *   // modifiers come from separate toggle buttons, not from the event
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { jsKeyToXkb } from "./key-name-map";

// ── Types ──

export type RecorderStatus = "idle" | "recording";

/**
 * A fully resolved key combination.
 * The inline recorder fills all fields from the KeyboardEvent.
 * The dialog recorder fills only `key` and keeps modifiers from button state.
 */
export interface CapturedCombo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  super: boolean;
}

export type CaptureHandler = (combo: CapturedCombo) => void;

// ── Hook ──

/**
 * useKeyRecorder — shared key capture hook.
 *
 * @param onCapture — called when a non-modifier key is pressed during recording
 * @returns handler state and methods
 */
export function useKeyRecorder(onCapture: CaptureHandler) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  // Guard: if the component unmounts while recording, don't set state
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const start = useCallback(() => {
    setStatus("recording");
  }, []);

  const cancel = useCallback(() => {
    setStatus("idle");
  }, []);

  /**
   * Handle a native KeyboardEvent during recording.
   *
   * - Escape → cancels recording
   * - Modifier-only keys (Control, Alt, Shift, Meta) → ignored
   * - Any other key → translated to XKB, combined with modifier flags, captured
   */
  const handleKeyEvent = useCallback((nativeEvent: KeyboardEvent) => {
    if (nativeEvent.key === "Escape") {
      nativeEvent.preventDefault();
      nativeEvent.stopPropagation();
      setStatus("idle");
      return;
    }

    // Ignore repeated events from holding a key
    if (nativeEvent.repeat) return;

    const key = jsKeyToXkb(nativeEvent.key);

    // Modifier-only keys (Control, Alt, etc.) — ignore, don't stop recording
    if (key === null) return;

    // Check that we actually got a non-empty key
    if (!key) return;

    nativeEvent.preventDefault();
    nativeEvent.stopPropagation();

    const combo: CapturedCombo = {
      key,
      ctrl: nativeEvent.ctrlKey,
      alt: nativeEvent.altKey,
      shift: nativeEvent.shiftKey,
      super: nativeEvent.metaKey,
    };

    if (mountedRef.current) {
      setStatus("idle");
    }
    onCaptureRef.current(combo);
  }, []);

  return { status, start, cancel, handleKeyEvent } as const;
}
