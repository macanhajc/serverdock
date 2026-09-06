import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror, { keymap, type Extension } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import {
  DragAndDrop,
  File as FileIcon,
  Folder,
  FolderPlus,
  Home,
  Plus,
  Refresh,
  Save,
  Undo,
} from 'pixelarticons/react';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { ConfirmModal } from '../../../../components/core/ConfirmModal';
import { filesEditorTheme } from '../../../../utils/codeMirrorTheme';
import type { FileEntry, OpenFile } from '../../../../types';
import { FileItem } from './FileItem';
import { useDirectoryListing } from '../hooks/useDirectoryListing';
import { useFileContent } from '../hooks/useFileContent';
import { useSaveFile } from '../hooks/useSaveFile';
import { useUploadFiles } from '../hooks/useUploadFiles';
import { useRenameEntry } from '../hooks/useRenameEntry';
import { useRemoveEntry } from '../hooks/useRemoveEntry';
import { useCreateDirectory } from '../hooks/useCreateDirectory';
import { useDownloadFile } from '../hooks/useDownloadFile';

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
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [fileError, setFileError] = useState('');
  const [dragCount, setDragCount] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState<FileEntry | null>(null);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const [creating, setCreating] = useState<'file' | 'directory' | null>(null);
  const [createName, setCreateName] = useState('');

  const listingQuery = useDirectoryListing(id, token, currentPath);
  const entries = listingQuery.data ?? [];
  const listError = listingQuery.isError;

  const fileContentQuery = useFileContent(id, token, openFile?.path);
  const saveFileMutation = useSaveFile(id, token);
  const uploadFilesMutation = useUploadFiles(id, token);
  const renameEntryMutation = useRenameEntry(id, token);
  const removeEntryMutation = useRemoveEntry(id, token);
  const createDirectoryMutation = useCreateDirectory(id, token);
  const downloadFileMutation = useDownloadFile(id, token);

  // Clear immediately on file change (avoids flashing the previous file's
  // content while the new one is still loading), then populate once the
  // query for the new path resolves.
  useEffect(() => {
    setFileContent('');
    setSavedContent('');
    setFileError('');
  }, [openFile?.path]);

  useEffect(() => {
    if (fileContentQuery.data !== undefined) {
      setFileContent(fileContentQuery.data);
      setSavedContent(fileContentQuery.data);
    }
  }, [fileContentQuery.data]);

  useEffect(() => {
    if (fileContentQuery.isError) {
      setFileError(
        fileContentQuery.error instanceof Error ? fileContentQuery.error.message : 'Read failed'
      );
    }
  }, [fileContentQuery.isError, fileContentQuery.error]);

  const fileLines = fileContent ? fileContent.split('\n') : [''];
  const fileDirty = fileContent !== savedContent;
  const fileSaving = saveFileMutation.isPending;
  const uploading = uploadFilesMutation.isPending;

  // Route navigation through here — unsaved editor changes need an explicit discard
  function guardNav(go: () => void) {
    if (openFile && fileDirty) {
      setPendingNav(() => go);
    } else {
      go();
    }
  }

  function saveFile() {
    if (!openFile || fileSaving || !writable) return;
    setFileError('');
    saveFileMutation.mutate(
      { path: openFile.path, content: fileContent },
      {
        onSuccess: () => {
          setSavedContent(fileContent);
          addToast('File saved');
        },
        onError: (err) => setFileError(err instanceof Error ? err.message : 'Save failed'),
      }
    );
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

  function uploadFiles(fileList: File[]) {
    if (!fileList.length || !writable) return;
    uploadFilesMutation.mutate(
      { path: currentPath, files: fileList },
      {
        onSuccess: (uploaded) => addToast(t('serverDetail.uploadDone', { count: uploaded.length })),
        onError: (err) =>
          addToast(
            err instanceof Error && err.message ? err.message : t('serverDetail.uploadFailed')
          ),
      }
    );
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

  function renameEntry(entry: FileEntry, newName: string) {
    const path = entryPath(entry.name);
    renameEntryMutation.mutate(
      { path, newName },
      {
        onSuccess: () => {
          if (openFile?.path === path) setOpenFile({ path: entryPath(newName), name: newName });
        },
        onError: (err) =>
          addToast(
            err instanceof Error && err.message ? err.message : t('serverDetail.renameFailed')
          ),
      }
    );
  }

  function removeEntry(entry: FileEntry) {
    const path = entryPath(entry.name);
    removeEntryMutation.mutate(path, {
      onSuccess: () => {
        if (openFile?.path === path || openFile?.path.startsWith(path + '/')) setOpenFile(null);
      },
      onError: (err) =>
        addToast(
          err instanceof Error && err.message ? err.message : t('serverDetail.removeFailed')
        ),
    });
  }

  function downloadEntry(entry: FileEntry) {
    const path = entryPath(entry.name);
    downloadFileMutation.mutate(
      { path, filename: entry.name },
      { onError: () => addToast(t('serverDetail.filesDownloadFailed')) }
    );
  }

  function commitCreate() {
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
    if (kind === 'directory') {
      createDirectoryMutation.mutate(path, {
        onError: (err) =>
          addToast(
            err instanceof Error && err.message ? err.message : t('serverDetail.filesCreateFailed')
          ),
      });
    } else {
      saveFileMutation.mutate(
        { path, content: '' },
        {
          onSuccess: () => setOpenFile({ path, name }),
          onError: (err) =>
            addToast(
              err instanceof Error && err.message
                ? err.message
                : t('serverDetail.filesCreateFailed')
            ),
        }
      );
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
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 font-mono text-xs text-ink pointer-events-none"
            style={{
              border: '2px dashed var(--accent-edge)',
              background: 'color-mix(in oklab, var(--accent) 12%, var(--bg-1))',
            }}
          >
            <DragAndDrop width={22} height={22} />
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
            className="inline-flex items-center gap-1 text-ink-2 cursor-pointer hover:text-ink"
            onClick={() => navigateToSegment(-1)}
          >
            <Home width={11} height={11} />
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
                className="inline-flex items-center gap-1 text-ink-3 hover:text-ink cursor-pointer"
                title={t('serverDetail.filesNewFile')}
                onClick={() => {
                  setCreating('file');
                  setCreateName('');
                }}
              >
                <Plus width={11} height={11} />
                {t('serverDetail.filesNewFile')}
              </button>
              <button
                className="inline-flex items-center gap-1 text-ink-3 hover:text-ink cursor-pointer"
                title={t('serverDetail.filesNewFolder')}
                onClick={() => {
                  setCreating('directory');
                  setCreateName('');
                }}
              >
                <FolderPlus width={11} height={11} />
                {t('serverDetail.filesNewFolder')}
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
              {creating === 'directory' ? (
                <Folder width={13} height={13} className="flex-none text-[#caa45a] opacity-90" />
              ) : (
                <FileIcon width={13} height={13} className="flex-none text-ink-3" />
              )}
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
              <Button size="sm" variant="ghost" onClick={() => listingQuery.refetch()}>
                <Refresh width={12} height={12} className="mr-1.5" />
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            entries.length === 0 &&
            !creating && (
              <span className="flex items-center gap-2 font-mono text-sm text-ink-3 px-3 py-2">
                <Folder width={14} height={14} />
                {currentPath === '/' ? t('serverDetail.noFiles') : t('serverDetail.emptyFolder')}
              </span>
            )
          )}
        </div>
      </div>

      {!openFile ? (
        <div className="bg-[#0c0c0c] grid place-items-center p-8">
          <div className="flex flex-col items-center gap-3 border border-dashed border-line-2 px-7 py-6 font-mono text-xs text-ink-3 text-center leading-relaxed">
            <FileIcon width={22} height={22} />
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
                <Undo width={12} height={12} className="mr-1.5" />
                {t('serverDetail.revert')}
              </Button>
              <Button
                size="sm"
                variant={fileDirty ? 'primary' : 'default'}
                disabled={!writable || !fileDirty || fileSaving}
                onClick={saveFile}
              >
                <Save width={12} height={12} className="mr-1.5" />
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
