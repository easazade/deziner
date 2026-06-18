import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

// Messages that the webview can send back to the extension host.
// `ready` asks for the current document contents, while `replaceDocument`
// asks VS Code to overwrite the underlying text file with new content.
type WebviewMessage =
  | {
      type: "ready";
    }
  | {
      type: "replaceDocument";
      text: string;
    };

// Custom editor provider for Deziner design files. VS Code calls this class
// whenever a document is opened with the Deziner visual editor view type.
export class DezinerEditorProvider implements vscode.CustomTextEditorProvider {
  // Must match the custom editor viewType declared in package.json.
  public static readonly viewType = "deziner.visualEditor";

  public constructor(private readonly context: vscode.ExtensionContext) {}

  // Entry point for the custom text editor. This wires the VS Code document to
  // the webview UI and keeps both sides in sync.
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    console.log(
      `Deziner resolving visual editor for ${document.uri.toString()}`,
    );
    console.log(`current document: ${document}`);

    const webview = webviewPanel.webview;

    // Limit the webview to loading only files from the bundled webview output
    // directory. This is safer than allowing access to the whole extension.
    const webviewDirectory = vscode.Uri.joinPath(
      this.context.extensionUri,
      "dist",
      "webview",
    );
    console.log(`webviewDirectory: ${webviewDirectory}`);

    // Enable JavaScript for the visual editor and define which local files it
    // is allowed to load with vscode-resource/webview URIs.
    webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewDirectory],
    };

    // Build and assign the HTML shell that loads the compiled webview app.
    webview.html = this.getWebviewHtml(webview);

    // Track event subscriptions so they can be cleaned up when the editor tab
    // closes. This avoids leaks and duplicate event handlers.
    const disposables: vscode.Disposable[] = [];

    // Push the current text document contents into the webview. The webview can
    // then render the code-backed design visually.
    const sendDocumentToWebview = (): void => {
      void webview.postMessage({
        type: "documentChanged",
        text: document.getText(),
      });
    };

    // Whenever the backing text document changes in VS Code, notify this
    // webview so the visual editor stays in sync with external edits.
    disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          sendDocumentToWebview();
        }
      }),
    );

    // Handle messages from the webview. The UI first announces that it is ready,
    // then later can request full-document replacements after visual edits.
    disposables.push(
      webview.onDidReceiveMessage(async (message: WebviewMessage) => {
        console.log(`webview received message ${message}`);

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

    // Dispose all listeners created for this editor instance when its tab is
    // closed.
    webviewPanel.onDidDispose(() => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
  }

  // Replace the complete text document with content produced by the webview.
  // Using WorkspaceEdit keeps the change in VS Code's normal edit/undo system.
  private async replaceDocument(
    document: vscode.TextDocument,
    newText: string,
  ): Promise<void> {
    const currentText = document.getText();

    // Avoid creating an undo step when the webview sends content that is already
    // identical to the document.
    if (currentText === newText) {
      return;
    }

    // Build a range that spans the entire current document.
    const fullDocumentRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(currentText.length),
    );

    const edit = new vscode.WorkspaceEdit();

    // Queue the replacement, then apply it through VS Code.
    edit.replace(document.uri, fullDocumentRange, newText);

    const editWasApplied = await vscode.workspace.applyEdit(edit);

    // Surface failures to the user instead of silently dropping webview edits.
    if (!editWasApplied) {
      void vscode.window.showErrorMessage(
        "Deziner could not update the document.",
      );
    }
  }

  // Generate the HTML document loaded inside the VS Code webview. This points
  // at the compiled JavaScript and CSS assets and defines a restrictive CSP.
  private getWebviewHtml(webview: vscode.Webview): string {
    console.log("Deziner loading webview assets from dist/webview.");

    // Convert extension-file URIs into webview-safe URIs that the browser frame
    // is allowed to request.
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

    // A per-render nonce allows only the script tags generated below to run.
    const nonce = randomBytes(16).toString("base64");

    return /* html */ `
			<!doctype html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">

					<!-- Content Security Policy: block everything by default, then allow
						 only this webview's bundled styles, scripts with the generated nonce,
						 and safe image/font sources. -->
					<meta
						http-equiv="Content-Security-Policy"
						content="
							default-src 'none';
							style-src ${webview.cspSource} 'unsafe-inline';
							script-src ${webview.cspSource} 'nonce-${nonce}';
							img-src ${webview.cspSource} data: https:;
							font-src ${webview.cspSource} data:;
						"
					>

					<meta
						name="viewport"
						content="width=device-width, initial-scale=1.0"
					>

					<!-- Load the compiled webview stylesheet. -->
					<link
						rel="stylesheet"
						href="${styleUri}"
					>

					<title>Deziner Visual Editor</title>
				</head>

				<body>
					<!-- Root element where the bundled webview application mounts. -->
					<div id="root" color: var(--vscode-foreground, #cccccc);">
						Loading Deziner Visual Editor...
					</div>

					<!-- Simple fallback error display for failures before the app can render. -->
					<script nonce="${nonce}">
						window.addEventListener('error', event => {
							const root = document.getElementById('root');
							if (root) {
								root.textContent = 'Deziner webview error: ' + event.message;
							}
						});
					</script>

					<!-- Load the compiled webview JavaScript app. -->
					<script
						defer
						nonce="${nonce}"
						src="${scriptUri}"
					></script>
				</body>
			</html>
		`;
  }
}
