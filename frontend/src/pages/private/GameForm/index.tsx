import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../context/AuthContext';
import socket from '../../../socket';
import { templates } from '../../../data/templates';
import { Button } from '../../../components/core/Button';
import { TextField } from '../../../components/forms/TextField';
import { SegmentedControl } from '../../../components/forms/SegmentedControl';
import { Toggle } from '../../../components/core/Toggle';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import { StatusBadge } from '../../../components/core/StatusBadge';
import type { GameTemplate, PortFormRow, EnvVarRow } from '../../../types';
import { TplTile } from './components/TplTile';
import { FormSection } from './components/FormSection';
import { BuildLine } from './components/BuildLine';
import { PortRow } from './components/PortRow';
import { AddRowBtn } from './components/AddRowBtn';
import { EnvRow } from './components/EnvRow';

// ─── constants ────────────────────────────────────────────────────────────────

const BLANK_TEMPLATE: GameTemplate = {
  id: 'blank',
  name: 'Blank',
  description: '',
  imageSource: 'public',
  image: '',
  dockerfile: '',
  ports: [],
  environment: [],
};

const ALL_TEMPLATES: GameTemplate[] = [BLANK_TEMPLATE, ...templates];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type BuildStatus = 'none' | 'building' | 'ok' | 'failed';

export default function GameForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { token } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageSource, setImageSource] = useState('public');
  const [image, setImage] = useState('');
  const [dataMount, setDataMount] = useState('/data');
  const [dockerfile, setDockerfile] = useState('');
  const [ports, setPorts] = useState<PortFormRow[]>([]);
  const [envVars, setEnvVars] = useState<EnvVarRow[]>([]);
  const [idTouched, setIdTouched] = useState(false);

  const [storeUrl, setStoreUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [rconEnabled, setRconEnabled] = useState(false);
  const [rconPort, setRconPort] = useState('');
  const [rconPassword, setRconPassword] = useState('');

  const [activeTpl, setActiveTpl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [otherGames, setOtherGames] = useState<
    Array<{ id: string; name: string; ports?: Array<{ host: number; protocol: string }> }>
  >([]);
  const [queryType, setQueryType] = useState('none');
  const [queryPort, setQueryPort] = useState('');
  const [cpuLimit, setCpuLimit] = useState('');
  const [memoryLimit, setMemoryLimit] = useState('');

  const [savedId, setSavedId] = useState<string | null>(isEdit ? id : null);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('none');
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const buildLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/games', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setOtherGames(list.filter((g: { id: string }) => g.id !== id)))
      .catch(() => {});
  }, [id, token]);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/games/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((game) => {
        setName(game.name);
        setSlug(game.id);
        setDescription(game.description ?? '');
        setImageSource(game.imageSource ?? 'public');
        setImage(game.image ?? '');
        setDataMount(game.dataMount ?? '/data');
        setStoreUrl(game.storeUrl ?? '');
        setAvatarPreview(
          game.avatar ? `/api/servers/${id}/avatar?v=${game.avatarVersion ?? 0}` : null
        );
        setAvatarFile(null);
        setRemoveAvatar(false);
        setQueryType(game.query?.type ?? 'none');
        setQueryPort(game.query?.port ? String(game.query.port) : '');
        setDockerfile('');
        setPorts(
          (game.ports ?? []).map((p: { host: number; container: number; protocol: string }) => ({
            ...p,
            host: String(p.host),
            container: String(p.container),
          }))
        );
        setEnvVars(game.environment ?? []);
        setCpuLimit(game.resources?.cpuLimit != null ? String(game.resources.cpuLimit) : '');
        setMemoryLimit(
          game.resources?.memoryLimit != null ? String(game.resources.memoryLimit) : ''
        );
        setRconEnabled(!!game.rcon?.enabled);
        setRconPort(game.rcon?.port ? String(game.rcon.port) : '');
        setRconPassword(game.rcon?.password ?? '');
      })
      .catch(() => setError(t('gameForm.errLoadFailed')));
  }, [id, isEdit, token, t]);

  useEffect(() => {
    if (buildLogRef.current) {
      buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
    }
  }, [buildLog]);

  // Revoke the previous object URL whenever the preview changes/unmounts —
  // server-side avatar URLs (starting with /api/...) aren't blob: URLs, so this is a no-op for those.
  useEffect(() => {
    if (!avatarPreview?.startsWith('blob:')) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const AVATAR_MAX_BYTES = 4 * 1024 * 1024;

  function handleAvatarChange(file: File | null) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError(t('gameForm.errAvatarType'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(t('gameForm.errAvatarSize'));
      return;
    }
    setAvatarError('');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  }

  function handleRemoveAvatar() {
    setAvatarError('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }

  useEffect(() => {
    if (!savedId || buildStatus !== 'building') return;

    function onLine({ id: bid, line }: { id: string; line: string }) {
      if (bid !== savedId) return;
      setBuildLog((prev) => [...prev, line]);
    }
    function onComplete({ id: bid }: { id: string }) {
      if (bid !== savedId) return;
      setBuildStatus('ok');
    }
    function onFailed({ id: bid, error: err }: { id: string; error?: string }) {
      if (bid !== savedId) return;
      setBuildStatus('failed');
      if (err) setBuildLog((prev) => [...prev, `Error: ${err}`]);
    }

    socket.on('build:line', onLine);
    socket.on('build:complete', onComplete);
    socket.on('build:failed', onFailed);
    socket.emit('join:build', { id: savedId });

    return () => {
      socket.off('build:line', onLine);
      socket.off('build:complete', onComplete);
      socket.off('build:failed', onFailed);
      socket.emit('leave:build', { id: savedId });
    };
  }, [savedId, buildStatus]);

  function applyTemplate(tpl: GameTemplate) {
    setActiveTpl(tpl.id);
    setIdTouched(false);
    setName('');
    setSlug('');
    setDescription(tpl.description ?? '');
    setImageSource(tpl.imageSource ?? 'public');
    setImage(tpl.image ?? '');
    setDataMount(tpl.dataMount ?? '/data');
    setQueryType(tpl.query?.type ?? 'none');
    setQueryPort(tpl.query?.port ? String(tpl.query.port) : '');
    setDockerfile(tpl.dockerfileTemplate ?? '');
    setPorts(
      (tpl.ports ?? []).map((p) => ({ ...p, host: String(p.host), container: String(p.container) }))
    );
    setEnvVars(tpl.environment ?? []);
    setRconEnabled(!!tpl.rcon?.enabled);
    setRconPort(tpl.rcon?.port ? String(tpl.rcon.port) : '');
    setRconPassword(tpl.rcon?.password ?? '');
    setStoreUrl('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
    setAvatarError('');
  }

  function handleNameChange(v: string) {
    setName(v);
    if (!idTouched) setSlug(slugify(v));
  }

  function handleSlugChange(v: string) {
    setIdTouched(true);
    setSlug(v);
  }

  function addPort() {
    setPorts((prev) => [...prev, { host: '', container: '', protocol: 'tcp' }]);
  }
  function updatePort(idx: number, field: keyof PortFormRow, value: string) {
    setPorts((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }
  function removePort(idx: number) {
    setPorts((prev) => prev.filter((_, i) => i !== idx));
  }

  function addEnvVar() {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  }
  function updateEnvVar(idx: number, field: keyof EnvVarRow | 'pinned', value: string | boolean) {
    setEnvVars((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  }
  function removeEnvVar(idx: number) {
    setEnvVars((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(buildAfter = false) {
    setError('');

    if (!name.trim()) {
      setError(t('gameForm.errNameRequired'));
      return;
    }
    if (!slug.trim()) {
      setError(t('gameForm.errIdRequired'));
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError(t('gameForm.errIdInvalid'));
      return;
    }
    if (!image.trim()) {
      setError(t('gameForm.errImageRequired'));
      return;
    }

    for (const p of ports) {
      const h = Number(p.host);
      const c = Number(p.container);
      if (!p.host || !p.container) continue;
      if (!Number.isInteger(h) || h < 1 || h > 65535) {
        setError(t('gameForm.errHostPort', { port: p.host }));
        return;
      }
      if (!Number.isInteger(c) || c < 1 || c > 65535) {
        setError(t('gameForm.errContainerPort', { port: p.container }));
        return;
      }
    }

    if (cpuLimit.trim()) {
      const v = parseFloat(cpuLimit);
      if (isNaN(v) || v <= 0) {
        setError(t('gameForm.errCpuInvalid'));
        return;
      }
    }
    if (memoryLimit.trim()) {
      const v = parseInt(memoryLimit, 10);
      if (isNaN(v) || v < 128) {
        setError(t('gameForm.errMemoryInvalid'));
        return;
      }
    }
    if (rconEnabled) {
      const p = Number(rconPort);
      if (!rconPort || !Number.isInteger(p) || p < 1 || p > 65535) {
        setError(t('gameForm.errRconPort'));
        return;
      }
      if (!rconPassword.trim()) {
        setError(t('gameForm.errRconPassword'));
        return;
      }
    }

    setSaving(true);

    const gameData = {
      id: slug,
      name: name.trim(),
      description: description.trim(),
      imageSource,
      image: image.trim(),
      storeUrl: storeUrl.trim() || null,
      dataMount: dataMount.trim() || '/data',
      query: queryType === 'a2s' && queryPort ? { type: 'a2s', port: Number(queryPort) } : null,
      ports: ports
        .filter((p) => p.host && p.container)
        .map((p) => ({
          host: Number(p.host),
          container: Number(p.container),
          protocol: p.protocol,
        })),
      environment: envVars
        .filter((e) => e.key.trim())
        .map((e) => ({ key: e.key.trim(), value: e.value, pinned: !!e.pinned })),
      resources: {
        cpuLimit: cpuLimit.trim() ? parseFloat(cpuLimit) : null,
        memoryLimit: memoryLimit.trim() ? parseInt(memoryLimit, 10) : null,
      },
      rcon: rconEnabled
        ? { enabled: true, port: Number(rconPort), password: rconPassword.trim() }
        : { enabled: false },
    };

    const url = isEdit ? `/api/games/${id}` : '/api/games';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(gameData),
    }).catch(() => null);

    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? t('gameForm.errSaveFailed'));
      setSaving(false);
      return;
    }

    const targetId = isEdit ? id! : slug;

    if (imageSource === 'local' && dockerfile.trim()) {
      const dfRes = await fetch(`/api/games/${targetId}/dockerfile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: dockerfile }),
      }).catch(() => null);

      if (!dfRes || !dfRes.ok) {
        const data = await dfRes?.json().catch(() => ({}));
        setError(data?.error ?? t('gameForm.errDockerfileFailed'));
        setSaving(false);
        return;
      }
    }

    if (avatarFile) {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const avatarRes = await fetch(`/api/games/${targetId}/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }).catch(() => null);

      if (!avatarRes || !avatarRes.ok) {
        const data = await avatarRes?.json().catch(() => ({}));
        setError(data?.error ?? t('gameForm.errAvatarFailed'));
        setSaving(false);
        return;
      }
    } else if (removeAvatar && isEdit) {
      await fetch(`/api/games/${targetId}/avatar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
    }

    if (!buildAfter) {
      navigate(`/admin/servers/${id ?? slug}`);
      return;
    }

    const buildRes = await fetch(`/api/games/${targetId}/build`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (!buildRes || !buildRes.ok) {
      const data = await buildRes?.json().catch(() => ({}));
      setError(data?.error ?? t('gameForm.errBuildFailed'));
      setSaving(false);
      return;
    }

    setSavedId(targetId);
    setBuildLog([]);
    setBuildStatus('building');
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    const res = await fetch(`/api/games/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? t('gameForm.errDeleteFailed'));
      setSaving(false);
      return;
    }

    navigate('/admin');
  }

  const isSteam = imageSource === 'local';
  const buildRunning = buildStatus === 'building';

  const imgSrcOptions = [
    { label: t('gameForm.imgPublic'), value: 'public' },
    { label: t('gameForm.imgLocal'), value: 'local' },
  ];

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 py-4 px-6 border-b border-line bg-bg-1 shrink-0">
        <button
          type="button"
          onClick={() => id ? navigate(`/admin/servers/${id}`) : navigate('/admin')}
          className="bg-bg-2 border border-line-2 text-ink-2 px-3 py-2 font-mono text-xs cursor-pointer hover:text-ink"
        >
          {t('gameForm.back')}
        </button>
        <div>
          <div className="text-4 font-bold">
            {isEdit ? t('gameForm.editTitle') : t('gameForm.addTitle')}
          </div>
          <div className="font-mono text-xs text-ink-3 mt-0.5">
            {isEdit ? t('gameForm.editSubtitle', { id }) : t('gameForm.newSubtitle')}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-6 pb-8 container">
          {!isEdit && (
            <div className="mb-6">
              <div className="font-mono tracking-widest uppercase text-ink-3 mb-3">
                {t('gameForm.templateHeading')}
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_TEMPLATES.map((tpl) => (
                  <TplTile
                    key={tpl.id}
                    tpl={tpl}
                    active={activeTpl === tpl.id}
                    onClick={() => applyTemplate(tpl)}
                  />
                ))}
              </div>
            </div>
          )}

          <FormSection title={t('gameForm.basicTitle')} desc={t('gameForm.basicDesc')}>
            <div className="grid grid-cols-2 gap-[14px_18px]">
              <TextField
                label={t('gameForm.fieldName')}
                placeholder="e.g. Valheim"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              <TextField
                label={t('gameForm.fieldIdSlug')}
                hint={isEdit ? t('gameForm.hintLocked') : t('gameForm.hintAuto')}
                mono
                placeholder="valheim"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                disabled={isEdit}
              />
            </div>
            <TextField
              label={t('gameForm.fieldDescription')}
              hint={t('gameForm.hintOptional')}
              textarea
              placeholder={t('gameForm.placeholderDesc')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-4"
            />
          </FormSection>

          <FormSection title={t('gameForm.presentationTitle')} desc={t('gameForm.presentationDesc')}>
            <div className="grid grid-cols-[120px_1fr] gap-[14px_18px] items-start">
              <div className="flex flex-col gap-2">
                <div className="w-30 h-30 border border-line bg-bg-2 overflow-hidden grid place-items-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-mono text-2xl font-bold text-ink-3">
                      {(name || slug).slice(0, 2).toUpperCase() || '—'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2" style={{width: "max-content"}}>
                  <Button size="sm" onClick={() => avatarInputRef.current?.click()}>
                    {t('gameForm.avatarUpload')}
                  </Button>
                  {avatarPreview && (
                    <Button size="sm" variant="ghost" onClick={handleRemoveAvatar}>
                      {t('gameForm.avatarRemove')}
                    </Button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                />
                {avatarError && (
                  <span className="font-mono text-[10px] text-red">{avatarError}</span>
                )}
              </div>
              <TextField
                label={t('gameForm.fieldStoreUrl')}
                hint={t('gameForm.hintStoreUrl')}
                mono
                placeholder="https://store.steampowered.com/app/…"
                value={storeUrl}
                onChange={(e) => setStoreUrl(e.target.value)}
              />
            </div>
          </FormSection>

          <FormSection title={t('gameForm.imageTitle')} desc={t('gameForm.imageDesc')}>
            <SegmentedControl
              options={imgSrcOptions}
              value={imageSource}
              onChange={setImageSource}
            />

            {!isSteam && (
              <div className="mt-4 grid grid-cols-[1fr_200px] gap-[14px_18px]">
                <TextField
                  label={t('gameForm.fieldDockerImage')}
                  mono
                  placeholder={t('gameForm.placeholderDockerImage')}
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                />
                <TextField
                  label={t('gameForm.fieldDataPath')}
                  hint={t('gameForm.hintSavesGo')}
                  mono
                  placeholder="/data"
                  value={dataMount}
                  onChange={(e) => setDataMount(e.target.value)}
                />
              </div>
            )}

            {isSteam && (
              <>
                <div className="mt-4 grid grid-cols-[1fr_200px] gap-[14px_18px]">
                  <TextField
                    label={t('gameForm.fieldBuiltImage')}
                    hint={t('gameForm.hintImageTag')}
                    mono
                    placeholder={t('gameForm.placeholderBuiltImage')}
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                  />
                  <TextField
                    label={t('gameForm.fieldDataPath')}
                    hint={t('gameForm.hintSavesGo')}
                    mono
                    placeholder="/data"
                    value={dataMount}
                    onChange={(e) => setDataMount(e.target.value)}
                  />
                </div>
                <TextField
                  label={t('gameForm.fieldDockerfile')}
                  textarea
                  code
                  placeholder={
                    isEdit
                      ? t('gameForm.placeholderKeepDockerfile')
                      : t('gameForm.placeholderNewDockerfile')
                  }
                  value={dockerfile}
                  onChange={(e) => setDockerfile(e.target.value)}
                  className="mt-4"
                  inputClassName="min-h-[160px]"
                />

                <div className="mt-4 border border-line bg-[#0c0c0c]">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-bg-1">
                    <span className="font-mono text-sm tracking-[.08em] uppercase text-ink-3">
                      {t('gameForm.buildLogTitle')}
                    </span>
                    {buildStatus !== 'none' && (
                      <>
                        <StatusBadge
                          status={
                            buildStatus === 'building'
                              ? 'building'
                              : buildStatus === 'ok'
                                ? 'built'
                                : 'none'
                          }
                          label={
                            buildStatus === 'building'
                              ? t('gameForm.buildBuilding')
                              : buildStatus === 'ok'
                                ? t('gameForm.buildComplete')
                                : t('gameForm.buildFailed')
                          }
                          className="ml-auto"
                        />
                        {!buildRunning && (
                          <Button
                            size="sm"
                            variant={buildStatus === 'ok' ? 'primary' : 'ghost'}
                            onClick={() => navigate('/admin')}
                          >
                            {buildStatus === 'ok'
                              ? t('gameForm.buildToDashboard')
                              : t('gameForm.buildClose')}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    ref={buildLogRef}
                    className="font-mono text-sm leading-6 px-3 py-3.5 h-37.5 overflow-y-auto"
                  >
                    {buildStatus === 'none' && (
                      <span className="text-ink-3">{t('gameForm.buildLogPrompt')}</span>
                    )}
                    {buildLog.map((line, i) => (
                      <BuildLine key={i} line={line} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </FormSection>

          <FormSection title={t('gameForm.resourcesTitle')} desc={t('gameForm.resourcesDesc')}>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label={t('gameForm.fieldCpuLimit')}
                hint={t('gameForm.hintCores')}
                mono
                type="number"
                step="0.1"
                min="0.1"
                placeholder="1"
                value={cpuLimit}
                onChange={(e) => setCpuLimit(e.target.value)}
              />
              <TextField
                label={t('gameForm.fieldMemoryLimit')}
                hint={t('gameForm.hintMB')}
                mono
                type="number"
                step="1"
                min="128"
                placeholder="1024"
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
              />
            </div>
          </FormSection>

          <FormSection title={t('gameForm.portsTitle')} desc={t('gameForm.portsDesc')}>
            {ports.length > 0 && (
              <div className="grid gap-2 mb-2 grid-cols-[1fr_1fr_100px_34px]">
                {[
                  t('gameForm.hostPort'),
                  t('gameForm.containerPort'),
                  t('gameForm.protocol'),
                  '',
                ].map((h, i) => (
                  <span key={i} className="font-mono text-sm tracking-[.06em] uppercase text-ink-3">
                    {h}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {(() => {
                const takenMap = new Map<string, string>();
                for (const g of otherGames) {
                  for (const p of g.ports ?? []) {
                    takenMap.set(`${p.host}/${p.protocol}`, g.name);
                  }
                }
                return ports.map((p, i) => (
                  <PortRow
                    key={i}
                    port={p}
                    idx={i}
                    onChange={updatePort}
                    onRemove={removePort}
                    conflictsWith={p.host ? takenMap.get(`${p.host}/${p.protocol}`) : undefined}
                  />
                ));
              })()}
            </div>

            <AddRowBtn onClick={addPort} label={t('gameForm.addPort')} />
          </FormSection>

          <FormSection title={t('gameForm.envTitle')} desc={t('gameForm.envDesc')}>
            {envVars.length > 0 && (
              <div className="grid gap-2 mb-2 grid-cols-[1fr_1.4fr_34px_34px]">
                {[t('gameForm.envKey'), t('gameForm.envValue'), '', ''].map((h, i) => (
                  <span key={i} className="font-mono text-sm tracking-[.06em] uppercase text-ink-3">
                    {h}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {envVars.map((e, i) => (
                <EnvRow
                  key={i}
                  env={e}
                  idx={i}
                  onChange={updateEnvVar}
                  onRemove={removeEnvVar}
                  pinnedLabel={t('gameForm.envPinned')}
                  pinLabel={t('gameForm.envPin')}
                />
              ))}
            </div>
            <AddRowBtn onClick={addEnvVar} label={t('gameForm.addVar')} />
          </FormSection>

          <FormSection title={t('gameForm.queryTitle')} desc={t('gameForm.queryDesc')}>
            <SegmentedControl
              options={[
                { label: t('gameForm.queryNone'), value: 'none' },
                { label: t('gameForm.queryA2s'), value: 'a2s' },
              ]}
              value={queryType}
              onChange={setQueryType}
            />
            {queryType === 'a2s' && (
              <TextField
                label={t('gameForm.fieldQueryPort')}
                hint={t('gameForm.hintA2sPort')}
                mono
                placeholder="27015"
                value={queryPort}
                onChange={(e) => setQueryPort(e.target.value)}
                className="mt-4 max-w-50"
                type="number"
                min="1"
                max="65535"
              />
            )}
          </FormSection>

          <FormSection title={t('gameForm.rconTitle')} desc={t('gameForm.rconDesc')}>
            <Toggle
              checked={rconEnabled}
              onChange={setRconEnabled}
              label={t('gameForm.rconEnabled')}
            />
            {rconEnabled && (
              <div className="grid grid-cols-2 gap-[14px_18px] mt-4">
                <TextField
                  label={t('gameForm.fieldRconPort')}
                  mono
                  type="number"
                  min="1"
                  max="65535"
                  placeholder="25575"
                  value={rconPort}
                  onChange={(e) => setRconPort(e.target.value)}
                />
                <TextField
                  label={t('gameForm.fieldRconPass')}
                  mono
                  type="password"
                  placeholder="••••••••"
                  value={rconPassword}
                  onChange={(e) => setRconPassword(e.target.value)}
                />
              </div>
            )}
          </FormSection>
        </div>
      </div>

      <div
        className="shrink-0 flex items-center gap-3 px-6 py-3 border-t border-line"
        style={{
          background: 'color-mix(in oklab, var(--bg-1) 94%, transparent)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {isEdit && (
          <Button variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>
            {t('gameForm.actDelete')}
          </Button>
        )}

        <span className="font-mono text-sm text-ink-3">
          {isSteam ? t('gameForm.footerSteam') : t('gameForm.footerPublic')}
        </span>

        <span className="flex-1" />

        {error && <span className="font-mono text-sm text-red max-w-70">{error}</span>}

        <Button variant="ghost" disabled={saving} onClick={() => navigate('/admin')}>
          {t('gameForm.actCancel')}
        </Button>

        <Button variant="primary" disabled={saving} onClick={() => handleSave(false)}>
          {saving && !buildRunning ? t('gameForm.actSaving') : t('gameForm.actSave')}
        </Button>

        {isSteam && (
          <Button
            variant="primary"
            disabled={saving || buildRunning}
            onClick={() => handleSave(true)}
          >
            {saving ? t('gameForm.actSaving') : t('gameForm.actSaveAndBuild')}
          </Button>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={t('gameForm.deleteTitle')}
          message={t('gameForm.deleteMessage', { name, id })}
          confirmLabel={t('gameForm.deleteConfirm')}
          onConfirm={() => {
            setConfirmDelete(false);
            handleDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
