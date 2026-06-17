export interface VsCodeApi<State = unknown> {
  postMessage(message: unknown): void;
  getState(): State | undefined;
  setState(state: State): void;
}

declare function acquireVsCodeApi<State = unknown>(): VsCodeApi<State>;

const browserFallback: VsCodeApi = {
  postMessage(message: unknown): void {
    console.log("VS Code message:", message);
  },

  getState(): undefined {
    return undefined;
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setState(_state: unknown): void {
    // The browser preview does not persist VS Code state.
  },
};

export const vscode: VsCodeApi =
  typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : browserFallback;
