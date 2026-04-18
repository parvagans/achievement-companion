import { useEffect, useState } from "react";
import type { ResourceState } from "@core/cache";

export type AsyncResourceLoader<T> = () => Promise<ResourceState<T>>;

export function useAsyncResourceState<T>(
  loader: AsyncResourceLoader<T>,
  initialState: ResourceState<T>,
): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>(initialState);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(loader)
      .then((nextState) => {
        if (!cancelled) {
          setState((currentState) => {
            if (currentState.data !== undefined && nextState.status === "error") {
              return {
                ...currentState,
                ...(nextState.error !== undefined ? { error: nextState.error } : {}),
              };
            }

            return nextState;
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loader]);

  return state;
}
