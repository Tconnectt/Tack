import { useEffect, useState } from "react";
import { errorMessage } from "./api";

interface State<T> {
  settledFor: string;
  key: string;
  data?: T;
  error?: string;
}

/**
 * Loads data when `key` changes. `reload()` fetches again.
 * Loading is derived (not set inside the effect). When the key changes the old data is dropped;
 * when only `reload()` is called, the old data stays on screen until the new data arrives.
 */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<State<T>>({ settledFor: "", key: "" });
  const current = `${key}#${version}`;

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ settledFor: current, key, data });
      },
      (err) => {
        if (!cancelled) setState((prev) => ({ settledFor: current, key, data: prev.key === key ? prev.data : undefined, error: errorMessage(err) }));
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; `current` is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const loading = state.settledFor !== current;
  return {
    loading,
    data: state.key === key ? state.data : undefined,
    error: loading ? undefined : state.error,
    reload: () => setVersion((v) => v + 1),
  };
}
