import * as vscode from "vscode";
import { DezinerEditorProvider } from "./DezinerEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(DezinerEditorProvider.register(context));
}

export function deactivate(): void {}
