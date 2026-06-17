import { useEffect, useState } from "react";
import { vscode } from "./vscode";

type ExtensionMessage = {
  type: "documentChanged";
  text: string;
};

export function App() {
  const [documentText, setDocumentText] = useState("");

  useEffect(() => {
    function handleMessage(event: MessageEvent<ExtensionMessage>): void {
      const message = event.data;

      if (message.type === "documentChanged") {
        setDocumentText(message.text);
      }
    }

    window.addEventListener("message", handleMessage);

    vscode.postMessage({
      type: "ready",
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  function applyChanges(): void {
    vscode.postMessage({
      type: "replaceDocument",
      text: documentText,
    });
  }

  return (
    <div className="app">
      <header className="toolbar">
        <strong>Deziner</strong>

        <div className="toolbarActions">
          <button type="button">Add element</button>
          <button type="button">Preview</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <h2>Elements</h2>

          <ul>
            <li>Page</li>
            <li>Header</li>
            <li>Content</li>
          </ul>
        </aside>

        <section className="canvas">
          <div className="page">
            <span className="eyebrow">Visual canvas</span>

            <h1>Deziner is running</h1>

            <p>
              This area will eventually render and edit your HTML document
              visually.
            </p>
          </div>
        </section>

        <aside className="sourcePanel">
          <h2>Document source</h2>

          <textarea
            value={documentText}
            onChange={(event) => {
              setDocumentText(event.target.value);
            }}
            spellCheck={false}
          />

          <button
            type="button"
            className="primaryButton"
            onClick={applyChanges}
          >
            Apply
          </button>
        </aside>
      </main>
    </div>
  );
}
