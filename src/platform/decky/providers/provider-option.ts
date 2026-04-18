import type { ProviderId } from "@core/domain";

export interface DeckyProviderOption {
  readonly id: ProviderId;
  readonly label: string;
  readonly iconSrc?: string;
  readonly enabled: boolean;
  readonly connected: boolean;
}
