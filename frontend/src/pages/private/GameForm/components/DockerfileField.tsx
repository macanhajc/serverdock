import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { filesEditorTheme } from '../../../../utils/codeMirrorTheme';

interface DockerfileFieldProps {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const dockerfileLang = StreamLanguage.define(dockerFile);

// Reuses the same editor/theme the Files tab upgraded to, rather than the
// plain <textarea> TextField gives every other multi-line field here — a
// Dockerfile is the one form field in this app that's actually source code.
export function DockerfileField({
  label,
  hint,
  placeholder,
  value,
  onChange,
  className = '',
}: DockerfileFieldProps) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-xs text-ink-2 flex items-center gap-2">{label}</span>
      <div className="border border-line overflow-hidden">
        <CodeMirror
          value={value}
          onChange={onChange}
          height="200px"
          theme={filesEditorTheme}
          placeholder={placeholder}
          extensions={[dockerfileLang]}
          style={{ fontSize: '12.5px' }}
        />
      </div>
      {hint && (
        <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[.06em]">{hint}</span>
      )}
    </label>
  );
}
