import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Download,
  File as FileIcon,
  Folder,
  MoreVertical,
  Pencil,
  Trash,
} from 'pixelarticons/react';
import { formatSize } from '../../../../utils/format';

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

export function FileItem({
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
        {isDir ? (
          <Folder width={13} height={13} className="flex-none text-[#caa45a] opacity-90" />
        ) : (
          <FileIcon width={13} height={13} className="flex-none text-ink-3" />
        )}
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
            <MoreVertical width={13} height={13} />
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
                className="w-full flex items-center gap-2 text-left px-3 py-2 font-mono text-xs text-ink-2 hover:bg-bg-3 hover:text-ink cursor-pointer"
                onClick={startRename}
              >
                <Pencil width={12} height={12} />
                {t('serverDetail.rename')}
              </button>
            )}
            {onDownload && (
              <button
                className="w-full flex items-center gap-2 text-left px-3 py-2 font-mono text-xs text-ink-2 hover:bg-bg-3 hover:text-ink cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  onDownload();
                }}
              >
                <Download width={12} height={12} />
                {t('serverDetail.filesDownload')}
              </button>
            )}
            {onRemove && (
              <button
                className="w-full flex items-center gap-2 text-left px-3 py-2 font-mono text-xs text-red hover:bg-bg-3 cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
              >
                <Trash width={12} height={12} />
                {t('serverDetail.remove')}
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
