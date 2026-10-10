import type { ReactNode } from "react";
import type { ResourceState } from "@core/cache";
import { DeckyLoadingBrandMark } from "../platform/decky/decky-loading-brand";

export interface PlaceholderStateProps {
  readonly title: string;
  readonly description: string;
  readonly state: ResourceState<unknown>;
  readonly providerId?: string | undefined;
  readonly loadingBrandCompact?: boolean;
  readonly footer?: ReactNode;
}

function getStatusCopy(state: ResourceState<unknown>): string {
  switch (state.status) {
    case "loading":
      return "Loading data.";
    case "refreshing":
      return "Refreshing while keeping current data visible.";
    case "stale":
      return "Showing current data while refresh completes.";
    case "error":
      return state.error?.userMessage ?? "Something went wrong.";
    case "success":
      return "Ready.";
    case "idle":
    default:
      return "Waiting for data.";
  }
}

export function PlaceholderState({
  title,
  description,
  state,
  providerId,
  loadingBrandCompact = true,
  footer,
}: PlaceholderStateProps): JSX.Element {
  const statusCopy = getStatusCopy(state);
  const cachedCopy = state.data ? "Current data is available." : "No data yet.";
  const isLoading = state.status === "loading" || state.status === "refreshing";

  return (
    <section
      aria-busy={state.status === "loading" || state.status === "refreshing"}
      aria-label={title}
      aria-live="polite"
      data-state={state.status}
      role={state.status === "error" ? "alert" : "status"}
    >
      {isLoading ? <DeckyLoadingBrandMark compact={loadingBrandCompact} isLoading providerId={providerId} /> : null}
      <header>
        <p>{title}</p>
        <h1>{statusCopy}</h1>
      </header>
      <p>{description}</p>
      <p>{cachedCopy}</p>
      {footer ? <footer>{footer}</footer> : null}
    </section>
  );
}
