import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

// Matches the plain-textarea editor this replaces (bg #0c0c0c / text #c8c8c8 /
// gutter #444), so swapping in CodeMirror doesn't clash with the rest of the
// app's terminal look (ConsoleTab, bg-terminal).
export const filesEditorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#0c0c0c',
    foreground: '#c8c8c8',
    caret: '#c8c8c8',
    selection: '#06b6d433',
    selectionMatch: '#06b6d433',
    gutterBackground: '#0c0c0c',
    gutterForeground: '#444',
    gutterBorder: 'transparent',
    lineHighlight: '#ffffff08',
    fontFamily: "'JetBrains Mono', monospace",
  },
  styles: [
    { tag: t.comment, color: '#6a737d' },
    { tag: t.string, color: '#9ecbff' },
    { tag: [t.number, t.bool, t.null], color: '#f8c555' },
    { tag: [t.keyword, t.operator], color: '#f97583' },
    { tag: t.propertyName, color: '#79b8ff' },
    { tag: t.definition(t.propertyName), color: '#79b8ff' },
  ],
});
