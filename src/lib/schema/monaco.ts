import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
import yamlWorker from '../../../node_modules/monaco-yaml/yaml.worker.js?worker';
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import '../../../node_modules/monaco-editor/min/vs/editor/editor.main.css';
import { formatSchema } from './format';
import { schemaDocument } from './language';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === 'yaml' ? new yamlWorker() : new editorWorker();
  }
};

let yamlHandle: ReturnType<typeof configureMonacoYaml> | null = null;
let formatting: monaco.IDisposable | null = null;

function installFormatter() {
  if (formatting) return;
  formatting = monaco.languages.registerDocumentFormattingEditProvider('yaml', {
    displayName: 'schéma',
    provideDocumentFormattingEdits(model) {
      const text = model.getValue();
      const next = formatSchema(text);
      if (next === text) return [];
      return [{ range: model.getFullModelRange(), text: next }];
    }
  });
}

export function mountYaml(
  host: HTMLElement,
  value: string,
  names: string[],
  onChange: (text: string) => void
) {
  const options = {
    enableSchemaRequest: false,
    format: { enable: false },
    schemas: [{
      uri: 'http://fc-coach-notebook/schema-0.json',
      fileMatch: ['schema.yaml', '*.yaml', 'file:///exercise/schema.yaml'],
      schema: schemaDocument(names)
    }]
  };
  installFormatter();
  if (!yamlHandle) yamlHandle = configureMonacoYaml(monaco, options);
  else void yamlHandle.update(options);
  const model = monaco.editor.createModel(value, 'yaml', monaco.Uri.parse('file:///exercise/schema.yaml'));
  const editor = monaco.editor.create(host, {
    model,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    tabSize: 2,
    scrollBeyondLastLine: false
  });
  editor.onDidChangeModelContent(() => onChange(editor.getValue()));
  return editor;
}

export function mountMarkdown(host: HTMLElement, value: string, onChange: (text: string) => void) {
  const uri = monaco.Uri.parse('file:///exercise/content.md');
  monaco.editor.getModel(uri)?.dispose();
  const model = monaco.editor.createModel(value, 'markdown', uri);
  const editor = monaco.editor.create(host, {
    model,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: 'on',
    scrollBeyondLastLine: false
  });
  editor.onDidChangeModelContent(() => onChange(editor.getValue()));
  return editor;
}
