import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

type WebviewMessage =
  | {
      type: "ready";
    }
  | {
      type: "replaceDocument";
      text: string;
    };

export class DezinerEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = "deziner.visualEditor";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DezinerEditorProvider(context);

    return vscode.window.registerCustomEditorProvider(
      DezinerEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    );
  }

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewPanel.webview;

    const webviewDirectory = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview",
    );

    webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewDirectory],
    };

    webview.html = this.getWebviewHtml(webview);

    const disposables: vscode.Disposable[] = [];

    const sendDocumentToWebview = (): void => {
      void webview.postMessage({
        type: "documentChanged",
        text: document.getText(),
      });
    };

    disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          sendDocumentToWebview();
        }
      }),
    );

    disposables.push(
      webview.onDidReceiveMessage(async (message: WebviewMessage) => {
        switch (message.type) {
          case "ready":
            sendDocumentToWebview();
            break;

          case "replaceDocument":
            await this.replaceDocument(document, message.text);
            break;
        }
      }),
    );

    webviewPanel.onDidDispose(() => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
  }

  private async replaceDocument(
    document: vscode.TextDocument,
    newText: string,
  ): Promise<void> {
    const currentText = document.getText();

    if (currentText === newText) {
      return;
    }

    const fullDocumentRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(currentText.length),
    );

    const edit = new vscode.WorkspaceEdit();

    edit.replace(document.uri, fullDocumentRange, newText);

    const editWasApplied = await vscode.workspace.applyEdit(edit);

    if (!editWasApplied) {
      void vscode.window.showErrorMessage(
        "Deziner could not update the document.",
      );
    }
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview",
        "webview.js",
      ),
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "dist",
        "webview",
        "webview.css",
      ),
    );

    const nonce = randomBytes(16).toString("base64");

    return /* html */ `
			<!doctype html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">

					<meta
						http-equiv="Content-Security-Policy"
						content="
							default-src 'none';
							style-src ${webview.cspSource};
							script-src 'nonce-${nonce}';
							img-src ${webview.cspSource} data: https:;
							font-src ${webview.cspSource} data:;
						"
					>

					<meta
						name="viewport"
						content="width=device-width, initial-scale=1.0"
					>

					<link
						rel="stylesheet"
						href="${styleUri}"
					>

					<title>Deziner Visual Editor</title>
				</head>

				<body>
					<div id="root"></div>

					<script
						type="module"
						nonce="${nonce}"
						src="${scriptUri}"
					></script>
				</body>
			</html>
		`;
  }
}
