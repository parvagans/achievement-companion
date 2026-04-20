type DeckyBackendCallImplementation = <Return>(route: string, ...args: unknown[]) => Promise<Return>;

let deckyBackendCallImplementation: DeckyBackendCallImplementation | undefined;
let deckyBackendCallPromise: Promise<DeckyBackendCallImplementation> | undefined;

export function setDeckyBackendCallImplementationForTests(
  implementation: DeckyBackendCallImplementation | undefined,
): void {
  deckyBackendCallImplementation = implementation;
  deckyBackendCallPromise = undefined;
}

async function resolveDeckyBackendCallImplementation(): Promise<DeckyBackendCallImplementation> {
  if (deckyBackendCallImplementation !== undefined) {
    return deckyBackendCallImplementation;
  }

  if (deckyBackendCallPromise === undefined) {
    deckyBackendCallPromise = import("@decky/api").then(({ call }) => call as DeckyBackendCallImplementation);
  }

  return deckyBackendCallPromise;
}

export async function callDeckyBackendMethod<Return>(
  route: string,
  ...args: unknown[]
): Promise<Return> {
  const callImplementation = await resolveDeckyBackendCallImplementation();
  return callImplementation<Return>(route, ...args);
}
