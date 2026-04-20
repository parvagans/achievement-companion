import { type CSSProperties, type ComponentProps, type FC } from "react";
import { TextField } from "@decky/ui";

type DeckyCredentialTextFieldProps = ComponentProps<typeof TextField> & {
  readonly autoComplete?: string;
  readonly autoCorrect?: string;
  readonly inputMode?: "text";
  readonly bIsPassword?: boolean;
};

export const DeckyCredentialTextField = TextField as unknown as FC<DeckyCredentialTextFieldProps>;

export function getDeckyCredentialTextFieldMaskStyle(): CSSProperties &
  { readonly WebkitTextSecurity: "disc" } {
  return {
    WebkitTextSecurity: "disc",
  } as CSSProperties & { readonly WebkitTextSecurity: "disc" };
}
