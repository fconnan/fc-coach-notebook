import editorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
import yamlWorker from '../../../node_modules/monaco-yaml/yaml.worker.js?worker';
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import '../../../node_modules/monaco-editor/min/vs/editor/editor.main.css';
import { schemaDocument } from './language';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === 'yaml' ? new yamlWorker() : new editorWorker();
  }
};

let yamlHandle: ReturnType<typeof configureMonacoYaml> | null = null;

export function mountYaml(
  host: HTMLElement,
  value: string,
  names: string[],
  onChange: (text: string) => void
) {
  const options = {
    enableSchemaRequest: false,
    schemas: [{
      uri: 'http://fc-tactics/schema-0.json',
      fileMatch: ['schema.yaml', '*.yaml', 'file:///exercise/schema.yaml'],
      schema: schemaDocument(names)
    }]
  };
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
