import * as vscode from "vscode";
import { DezinerEditorProvider } from "./DezinerEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Deziner extension activated.");

  context.subscriptions.push(
    DezinerEditorProvider.register(context),
    vscode.commands.registerCommand(
      "deziner.open",
      async (uri?: vscode.Uri) => {
        const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;

        if (!targetUri) {
          void vscode.window.showInformationMessage(
            "Open a .deziner.html file first.",
          );
          return;
        }

        await vscode.commands.executeCommand(
          "vscode.openWith",
          targetUri,
          DezinerEditorProvider.viewType,
        );
      },
    ),
  );
}

export function deactivate(): void {}
