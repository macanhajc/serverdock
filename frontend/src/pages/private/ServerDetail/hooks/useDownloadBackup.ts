import { useState } from 'react';

// Reads the response stream manually (instead of res.blob()) so progress can
// be reported from the Content-Length header against bytes received so far —
// doesn't fit a normal useMutation, which only has pending/success/error, not
// an incremental progress channel.
export function useDownloadBackup(id: string, token: string | null) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);

  async function download(backup: { id: string }): Promise<void> {
    setDownloadingId(backup.id);
    setDownloadPct(0);
    try {
      const res = await fetch(`/api/backups/${id}/${backup.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || !res.body) throw new Error();
      const total = Number(res.headers.get('Content-Length')) || 0;
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (total > 0) setDownloadPct(Math.min(99, Math.round((received / total) * 100)));
      }
      const blob = new Blob(chunks);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}-${backup.id}.tar.gz`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
      setDownloadPct(null);
    }
  }

  return { download, downloadingId, downloadPct };
}
