import { useState, useEffect, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import CodeMirror, { keymap, type Extension } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { formatSize } from '../../../../utils/format';
import { filesEditorTheme } from '../../../../utils/codeMirrorTheme';
import type { FileEntry, OpenFile } from '../../../../types';

// Highlighting for the file types people actually edit here; anything else
// still gets CodeMirror's line numbers/search/folding, just no coloring.
function languageExtension(filename: string): Extension[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return [json()];
    case 'yml':
    case 'yaml':
      return [yaml()];
    case 'properties':
    case 'conf':
    case 'cfg':
    case 'ini':
      return [StreamLanguage.define(properties)];
    default:
      return [];
  }
}

// ─── FileItem ─────────────────────────────────────────────────────────────────

interface FileItemProps {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string | null;
  active?: boolean;
  onClick: () => void;
  onRename?: (name: string) => void;
  onRemove?: () => void;
  onDownload?: () => void;
}

function FileItem({
  name,
  type,
  size,
  modified,
  active,
  onClick,
  onRename,
  onRemove,
  onDownload,
}: FileItemProps) {
  const { t } = useTranslation();
  const isDir = type === 'directory';
  const hasMenu = !!onRename || !!onRemove || !!onDownload;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpen]);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 2, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  }

  function startRename() {
    setMenuOpen(false);
    setDraft(name);
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename?.(trimmed);
    setRenaming(false);
  }

  function handleRenameKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    }
    if (e.key === 'Escape') setRenaming(false);
  }

  return (
    <>
      <div
        onClick={renaming ? undefined : onClick}
        title={modified ? new Date(modified).toLocaleString() : undefined}
        className={`group flex items-center gap-2.5 px-2.5 py-2 font-mono text-[12.5px] border ${
          renaming ? 'cursor-default' : 'cursor-pointer'
        } ${
          active
            ? 'bg-bg-2 text-ink border-line [box-shadow:inset_2px_0_0_var(--accent)]'
            : 'text-ink-2 border-transparent hover:bg-bg-2 hover:text-ink'
        }`}
      >
        <span
          className={`w-3 h-3 flex-none ${isDir ? 'bg-[#caa45a] opacity-80' : 'bg-[#3a3a3a] border border-[#4a4a4a]'}`}
        />
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKey}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-transparent border-b font-mono text-[12.5px] text-ink outline-none"
            style={{ borderColor: 'var(--accent-edge)' }}
          />
        ) : (
          <span className="flex-1 min-w-0 truncate">
            {name}
            {isDir && name !== '..' ? '/' : ''}
          </span>
        )}
        {!renaming && size != null && (
          <span className="text-sm text-ink-3 flex-none">{formatSize(size)}</span>
        )}
        {hasMenu && !renaming && (
          <button
            onClick={openMenu}
            className={`flex-none px-1 leading-none cursor-pointer text-ink-3 hover:text-ink transition-opacity ${
              menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            ···
          </button>
        )}
      </div>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
            className="bg-bg-2 border border-line-2 py-0.5 min-w-32.5"
          >
            {onRename && (
              <button
                className="w-full text-left px-3 py-2 font-mono text-xs text-ink-2 hover:bg-bg-3 hover:text-ink cursor-pointer"
                onClick={startRename}
              >
                {t('serverDetail.rename')}
              </button>
            )}
            {onDownload && (
              <button
                className="w-full text-left px-3 py-2 font-mono text-xs text-ink-2 hover:bg-bg-3 hover:text-ink cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  onDownload();
                }}
              >
                {t('serverDetail.filesDownload')}
              </button>
            )}
            {onRemove && (
              <button
                className="w-full text-left px-3 py-2 font-mono text-xs text-red hover:bg-bg-3 cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
              >
                {t('serverDetail.remove')}
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

// ─── FilesTab ─────────────────────────────────────────────────────────────────

interface FilesTabProps {
  id: string;
  token: string | null;
  // Files are mutable only while the server is stopped; the backend enforces
  // this too (409). When false the UI is read-only: browse/view/download only.
  editable: boolean;
  // files:write permission — a second, independent gate on the same actions.
  canWrite: boolean;
}

export function FilesTab({ id, token, editable, canWrite }: FilesTabProps) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  // Both the container must be stopped AND the caller must hold files:write —
  // kept separate from `editable` so the read-only banner can name the actual reason.
  const writable = editable && canWrite;

  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [listError, setListError] = useState(false);
  const [dirVersion, setDirVersion] = useState(0);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [fileSaving, setFileSaving] = useState(false);
  const [fileError, setFileError] = useState('');
  const [dragCount, setDragCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<FileEntry | null>(null);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const [creating, setCreating] = useState<'file' | 'directory' | null>(null);
  const [createName, setCreateName] = useState('');

  useEffect(() => {
    fetch(`/api/files/${id}?path=${encodeURIComponent(currentPath)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { entries: FileEntry[] }) => {
        setEntries(data.entries);
        setListError(false);
      })
      .catch(() => {
        setEntries([]);
        setListError(true);
      });
  }, [id, currentPath, token, dirVersion]);

  useEffect(() => {
    if (!openFile) return;
    setFileError('');
    setFileContent('');
    setSavedContent('');
    fetch(`/api/files/${id}/read?path=${encodeURIComponent(openFile.path)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? 'Read failed'))
      )
      .then((data: { content: string }) => {
        setFileContent(data.content);
        setSavedContent(data.content);
      })
      .catch((msg: unknown) => setFileError(String(msg)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFile?.path, id, token]);

  const fileLines = fileContent ? fileContent.split('\n') : [''];
  const fileDirty = fileContent !== savedContent;

  // Route navigation through here — unsaved editor changes need an explicit discard
  function guardNav(go: () => void) {
    if (openFile && fileDirty) {
      setPendingNav(() => go);
    } else {
      go();
    }
  }

  async function saveFile() {
    if (!openFile || fileSaving || !writable) return;
    setFileSaving(true);
    setFileError('');
    try {
      const res = await fetch(`/api/files/${id}/write`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openFile.path, content: fileContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFileError(data.error ?? 'Save failed');
        return;
      }
      setSavedContent(fileContent);
      addToast('File saved');
    } catch {
      setFileError('Save failed');
    } finally {
      setFileSaving(false);
    }
  }

  const saveKeymap = keymap.of([
    {
      key: 'Mod-s',
      run: () => {
        if (fileDirty) saveFile();
        return true;
      },
    },
  ]);

  async function uploadFiles(fileList: File[]) {
    if (!fileList.length || !writable) return;
    setUploading(true);
    const form = new FormData();
    for (const f of fileList) form.append('files', f);
    try {
      const res = await fetch(`/api/files/${id}/upload?path=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        addToast(t('serverDetail.uploadDone', { count: data.uploaded.length }));
        setDirVersion((v) => v + 1);
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('serverDetail.uploadFailed'));
      }
    } catch {
      addToast(t('serverDetail.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    setDragCount((c) => c + 1);
  }
  function onDragLeave() {
    setDragCount((c) => c - 1);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragCount(0);
    uploadFiles([...e.dataTransfer.files]);
  }

  const pathSegments = currentPath.split('/').filter(Boolean);

  function navigateToSegment(idx: number) {
    guardNav(() => {
      setCurrentPath(idx < 0 ? '/' : '/' + pathSegments.slice(0, idx + 1).join('/'));
      setOpenFile(null);
    });
  }

  function navigateUp() {
    guardNav(() => {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      setCurrentPath(parts.length ? '/' + parts.join('/') : '/');
      setOpenFile(null);
    });
  }

  function handleEntryClick(entry: FileEntry) {
    const p = entryPath(entry.name);
    if (entry.type === 'directory') {
      guardNav(() => {
        setCurrentPath(p);
        setOpenFile(null);
      });
    } else {
      if (openFile?.path === p) return;
      guardNav(() => setOpenFile({ path: p, name: entry.name }));
    }
  }

  function entryPath(name: string): string {
    return currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
  }

  async function renameEntry(entry: FileEntry, newName: string) {
    const path = entryPath(entry.name);
    try {
      const res = await fetch(`/api/files/${id}/rename`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, newName }),
      });
      if (res.ok) {
        if (openFile?.path === path) setOpenFile({ path: entryPath(newName), name: newName });
        setDirVersion((v) => v + 1);
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('serverDetail.renameFailed'));
      }
    } catch {
      addToast(t('serverDetail.renameFailed'));
    }
  }

  async function removeEntry(entry: FileEntry) {
    const path = entryPath(entry.name);
    try {
      const res = await fetch(`/api/files/${id}/delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (res.ok) {
        if (openFile?.path === path || openFile?.path.startsWith(path + '/')) setOpenFile(null);
        setDirVersion((v) => v + 1);
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('serverDetail.removeFailed'));
      }
    } catch {
      addToast(t('serverDetail.removeFailed'));
    }
  }

  async function downloadEntry(entry: FileEntry) {
    const path = entryPath(entry.name);
    try {
      const res = await fetch(`/api/files/${id}/download?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        addToast(t('serverDetail.filesDownloadFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast(t('serverDetail.filesDownloadFailed'));
    }
  }

  async function commitCreate() {
    const name = createName.trim();
    const kind = creating;
    setCreating(null);
    setCreateName('');
    if (!name || !kind || !writable) return;
    if (name.includes('/') || name.includes('\\')) {
      addToast(t('serverDetail.filesCreateFailed'));
      return;
    }
    const path = entryPath(name);
    try {
      const res =
        kind === 'directory'
          ? await fetch(`/api/files/${id}/mkdir`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ path }),
            })
          : await fetch(`/api/files/${id}/write`, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ path, content: '' }),
            });
      if (res.ok) {
        setDirVersion((v) => v + 1);
        if (kind === 'file') setOpenFile({ path, name });
      } else {
        const data = await res.json().catch(() => ({}));
        addToast(data.error ?? t('serverDetail.filesCreateFailed'));
      }
    } catch {
      addToast(t('serverDetail.filesCreateFailed'));
    }
  }

  function onCreateKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCreate();
    }
    if (e.key === 'Escape') {
      setCreating(null);
      setCreateName('');
    }
  }

  return (
    <div className="h-full grid grid-cols-[320px_1fr] overflow-hidden">
      <div
        className="flex flex-col border-r border-line bg-bg-1 overflow-hidden relative"
        onDragEnter={writable ? onDragEnter : undefined}
        onDragLeave={writable ? onDragLeave : undefined}
        onDragOver={writable ? onDragOver : undefined}
        onDrop={writable ? onDrop : undefined}
      >
        {dragCount > 0 && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center font-mono text-xs text-ink pointer-events-none"
            style={{
              border: '2px dashed var(--accent-edge)',
              background: 'color-mix(in oklab, var(--accent) 12%, var(--bg-1))',
            }}
          >
            <span className="text-[11px] text-ink-2">{t('serverDetail.dropHere')}</span>
          </div>
        )}
        {uploading && (
          <div
            className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse"
            style={{ background: 'var(--accent)' }}
          />
        )}
        <div className="flex items-center flex-wrap gap-1.5 px-4 py-3 border-b border-line font-mono text-xs text-ink-3 flex-none">
          <span
            className="text-ink-2 cursor-pointer hover:text-ink"
            onClick={() => navigateToSegment(-1)}
          >
            {t('serverDetail.dataRoot')}
          </span>
          {pathSegments.map((seg, i) => (
            <Fragment key={i}>
              <span className="text-[#444]">/</span>
              {i === pathSegments.length - 1 ? (
                <span className="text-ink">{seg}</span>
              ) : (
                <span
                  className="text-ink-2 cursor-pointer hover:text-ink"
                  onClick={() => navigateToSegment(i)}
                >
                  {seg}
                </span>
              )}
            </Fragment>
          ))}
          {writable && (
            <span className="ml-auto flex gap-2 flex-none">
              <button
                className="text-ink-3 hover:text-ink cursor-pointer"
                title={t('serverDetail.filesNewFile')}
                onClick={() => {
                  setCreating('file');
                  setCreateName('');
                }}
              >
                +{t('serverDetail.filesNewFile')}
              </button>
              <button
                className="text-ink-3 hover:text-ink cursor-pointer"
                title={t('serverDetail.filesNewFolder')}
                onClick={() => {
                  setCreating('directory');
                  setCreateName('');
                }}
              >
                +{t('serverDetail.filesNewFolder')}
              </button>
            </span>
          )}
        </div>

        {!editable && (
          <div
            className="flex items-center gap-2 px-4 py-2 border-b border-line font-mono text-[11px] text-yellow flex-none"
            style={{ background: 'color-mix(in oklab, var(--yellow) 8%, transparent)' }}
          >
            {t('serverDetail.filesReadOnly')}
          </div>
        )}
        {editable && !canWrite && (
          <div
            className="flex items-center gap-2 px-4 py-2 border-b border-line font-mono text-[11px] text-yellow flex-none"
            style={{ background: 'color-mix(in oklab, var(--yellow) 8%, transparent)' }}
          >
            {t('serverDetail.filesNoPermission')}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {creating && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 font-mono text-[12.5px] border border-line bg-bg-2">
              <span
                className={`w-3 h-3 flex-none ${
                  creating === 'directory'
                    ? 'bg-[#caa45a] opacity-80'
                    : 'bg-[#3a3a3a] border border-[#4a4a4a]'
                }`}
              />
              <input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={onCreateKeyDown}
                onBlur={commitCreate}
                placeholder={
                  creating === 'directory'
                    ? t('serverDetail.filesNewFolder')
                    : t('serverDetail.filesNewFile')
                }
                className="flex-1 min-w-0 bg-transparent border-b font-mono text-[12.5px] text-ink outline-none placeholder:text-ink-3"
                style={{ borderColor: 'var(--accent-edge)' }}
              />
            </div>
          )}
          {currentPath !== '/' && <FileItem name=".." type="directory" onClick={navigateUp} />}
          {entries.map((entry) => {
            const ep = entryPath(entry.name);
            return (
              <FileItem
                key={entry.name}
                name={entry.name}
                type={entry.type}
                size={entry.size}
                modified={entry.modified}
                active={openFile?.path === ep}
                onClick={() => handleEntryClick(entry)}
                onRename={writable ? (newName) => renameEntry(entry, newName) : undefined}
                onRemove={writable ? () => setConfirmRemove(entry) : undefined}
                onDownload={entry.type === 'file' ? () => downloadEntry(entry) : undefined}
              />
            );
          })}
          {listError ? (
            <div className="px-3 py-2 flex flex-col items-start gap-2">
              <span className="font-mono text-sm text-red">
                {t('serverDetail.filesLoadFailed')}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setDirVersion((v) => v + 1)}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            entries.length === 0 &&
            !creating && (
              <span className="font-mono text-sm text-ink-3 px-3 py-2 block">
                {currentPath === '/' ? t('serverDetail.noFiles') : t('serverDetail.emptyFolder')}
              </span>
            )
          )}
        </div>
      </div>

      {!openFile ? (
        <div className="bg-[#0c0c0c] grid place-items-center p-8">
          <div className="border border-dashed border-line-2 px-7 py-6 font-mono text-xs text-ink-3 text-center leading-relaxed">
            {t('serverDetail.selectFile')
              .split('\n')
              .map((line, i) => (
                <span key={i}>
                  {line}
                  {i === 0 && <br />}
                </span>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-w-0 bg-[#0c0c0c] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg-1 flex-none">
            <span className="font-mono text-xs text-ink">{openFile.name}</span>
            <span className="font-mono text-sm text-ink-3 truncate">
              {openFile.path} · {t('serverDetail.fileLines', { count: fileLines.length })}
            </span>
            <div className="ml-auto flex gap-1.5 flex-none">
              <Button
                size="sm"
                variant="ghost"
                disabled={!writable || !fileDirty || fileSaving}
                onClick={() => {
                  setFileContent(savedContent);
                  setFileError('');
                }}
              >
                {t('serverDetail.revert')}
              </Button>
              <Button
                size="sm"
                variant={fileDirty ? 'primary' : 'default'}
                disabled={!writable || !fileDirty || fileSaving}
                onClick={saveFile}
              >
                {fileSaving ? t('serverDetail.saving') : t('serverDetail.save')}
              </Button>
            </div>
          </div>

          {fileError && (
            <div
              className="font-mono text-sm text-red px-4 py-2 border-b border-line flex-none"
              style={{ background: 'color-mix(in oklab, var(--red) 10%, transparent)' }}
            >
              {fileError}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeMirror
              value={fileContent}
              onChange={(value) => setFileContent(value)}
              height="100%"
              style={{ height: '100%', fontSize: '12.5px' }}
              theme={filesEditorTheme}
              readOnly={!writable}
              basicSetup={{ highlightActiveLine: writable }}
              extensions={[...languageExtension(openFile.name), saveKeymap]}
            />
          </div>
        </div>
      )}

      {confirmRemove && (
        <ConfirmModal
          title={t('serverDetail.filesDeleteTitle', { name: confirmRemove.name })}
          message={
            confirmRemove.type === 'directory'
              ? t('serverDetail.filesDeleteFolderMessage')
              : t('serverDetail.filesDeleteFileMessage')
          }
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            removeEntry(confirmRemove);
            setConfirmRemove(null);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {pendingNav && (
        <ConfirmModal
          title={t('serverDetail.filesDiscardTitle')}
          message={t('serverDetail.filesDiscardMessage', { name: openFile?.name ?? '' })}
          confirmLabel={t('serverDetail.filesDiscardBtn')}
          onConfirm={() => {
            pendingNav();
            setPendingNav(null);
          }}
          onCancel={() => setPendingNav(null)}
        />
      )}
    </div>
  );
}
