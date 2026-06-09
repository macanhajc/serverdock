---
name: new-component
description: Scaffold a new React component for ServerDock following the dark Tailwind v4 theme, consistent prop patterns, and the shared component conventions from the spec. Use whenever adding a new UI component.
---

You are scaffolding a new React component for the ServerDock frontend. Follow these rules exactly.

## Step 1 — Gather info

If the user did not provide the following, ask before writing any code:
- Component name (PascalCase)
- What it renders (one sentence)
- Is it one of the known shared components? (StatusBadge, ConfirmModal, ActionButton, LiveLogViewer, FileEditor, DynamicFieldList, BuildLogViewer, Sidebar, TemplateSelector)
- Does it need Socket.io? (if yes: listener cleanup required)
- Does it need to call the API? (if yes: via axios with JWT from context)

## Step 2 — Scaffold the component

### Base template
```jsx
export default function ComponentName({ prop1, prop2 }) {
  return (
    <div className="...">
      {/* content */}
    </div>
  );
}
```

## Tailwind v4 dark theme conventions

Use these classes consistently across all components:

**Backgrounds:**
- Page/app background: `bg-gray-950`
- Card/panel background: `bg-gray-900`
- Input/textarea background: `bg-gray-800`
- Hover state: `hover:bg-gray-800`

**Text:**
- Primary text: `text-gray-100`
- Secondary/muted text: `text-gray-400`
- Disabled text: `text-gray-600`

**Borders:**
- Default border: `border border-gray-700`
- Focus ring: `focus:outline-none focus:ring-2 focus:ring-blue-500`

**Buttons:**
- Primary action: `bg-blue-600 hover:bg-blue-700 text-white`
- Destructive action: `bg-red-600 hover:bg-red-700 text-white`
- Secondary/ghost: `bg-gray-700 hover:bg-gray-600 text-gray-100`
- Disabled state: `opacity-50 cursor-not-allowed`
- Base padding: `px-4 py-2 rounded text-sm font-medium transition-colors`

**Status badge colors (StatusBadge component pattern):**
- running/online: `bg-green-500/20 text-green-400`
- stopped/offline: `bg-red-500/20 text-red-400`
- starting/restarting/pulling/building: `bg-yellow-500/20 text-yellow-400`
- not_created: `bg-gray-500/20 text-gray-400`

**Modals (ConfirmModal pattern):**
- Overlay: `fixed inset-0 bg-black/60 flex items-center justify-center z-50`
- Modal box: `bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md`

**Log/terminal viewer:**
- Container: `bg-black rounded font-mono text-sm text-gray-200 overflow-y-auto`

## Socket.io pattern (when needed)

```jsx
import { useEffect } from 'react';
import { socket } from '../socket'; // centralized instance

useEffect(() => {
  socket.emit('join:logs', { id });
  socket.on('log:line', handleLine);

  return () => {
    socket.emit('leave:logs', { id });
    socket.off('log:line', handleLine); // always clean up
  };
}, [id]);
```

## API call pattern (when needed)

```jsx
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // JWT from context

const { token } = useAuth();

const result = await axios.post(`/api/servers/${id}/start`, {}, {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Step 3 — Output

Provide the complete component file. Suggest the correct location under `frontend/src/components/` or `frontend/src/pages/` based on whether it is a shared component or a page.
