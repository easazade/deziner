import * as vscode from "vscode";

const VIEW_TYPE = "deziner.visualEditor";

class DezinerEditorProvider implements vscode.CustomTextEditorProvider {
  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getHtml();
  }

  private getHtml(): string {
    return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta
					name="viewport"
					content="width=device-width, initial-scale=1.0"
				>

				<title>Deziner</title>

				<style>
					body {
						font-family: var(--vscode-font-family);
						color: var(--vscode-foreground);
						background: var(--vscode-editor-background);
						padding: 24px;
					}

					.canvas {
						min-height: 400px;
						border: 1px solid var(--vscode-panel-border);
						border-radius: 8px;
						padding: 24px;
					}
				</style>
			</head>

			<body>
				<h1>Deziner</h1>

				<div class="canvas">
					Your WYSIWYG editor will live here.
				</div>
			</body>
			</html>
		`;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new DezinerEditorProvider();

  const registration = vscode.window.registerCustomEditorProvider(
    VIEW_TYPE,
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    },
  );

  context.subscriptions.push(registration);
}

export function deactivate(): void {}
