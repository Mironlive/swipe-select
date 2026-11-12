import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SelectionChangeReason, SelectionKey } from '../types';
import { sameKeys } from './range';

type Params = {
  selectedKeys?: readonly SelectionKey[] | ReadonlySet<SelectionKey>;
  defaultSelectedKeys?: readonly SelectionKey[];
  onSelectionChange?: (keys: SelectionKey[], reason: SelectionChangeReason) => void;
};

/**
 * Holds the selection.
 * - `ref` — always up to date (the gesture reads and writes it without waiting for a render).
 * - `state` — what React sees. During a gesture it is committed at most once per frame.
 * - external `selectedKeys` is synced in whenever it changes.
 */
export const useSelectionState = ({ selectedKeys, defaultSelectedKeys, onSelectionChange }: Params) => {
  const [state, setState] = useState<ReadonlySet<SelectionKey>>(
    () => new Set(selectedKeys ?? defaultSelectedKeys ?? []),
  );
  const ref = useRef<ReadonlySet<SelectionKey>>(state);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const onChangeRef = useRef(onSelectionChange);
  onChangeRef.current = onSelectionChange;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const flush = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mountedRef.current) {
      setState(ref.current);
    }
  }, []);

  /** Update during a gesture: ref immediately, render on the next frame. */
  const schedule = useCallback((next: ReadonlySet<SelectionKey>) => {
    ref.current = next;
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (mountedRef.current) {
        setState(ref.current);
      }
    });
  }, []);

  /** Immediate update + notify the outside. */
  const commit = useCallback(
    (next: ReadonlySet<SelectionKey>, reason: SelectionChangeReason) => {
      if (sameKeys(ref.current, next)) {
        return;
      }
      ref.current = next;
      flush();
      if (reason !== 'sync') {
        onChangeRef.current?.(Array.from(next), reason);
      }
    },
    [flush],
  );

  const emit = useCallback((reason: SelectionChangeReason) => {
    onChangeRef.current?.(Array.from(ref.current), reason);
  }, []);

  // Sync with external state.
  useLayoutEffect(() => {
    if (selectedKeys === undefined) {
      return;
    }
    if (sameKeys(ref.current, selectedKeys)) {
      return;
    }
    ref.current = new Set(selectedKeys);
    flush();
  }, [selectedKeys, flush]);

  return { selected: state, ref, schedule, commit, flush, emit };
};
