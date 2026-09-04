import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { Blocks, ChevronLeft } from 'pixelarticons/react';
import { useAuth } from '../../../context/AuthContext';
import { useBuildLog } from '../../../hooks/useBuildLog';
import { templates } from '../../../data/templates';
import { TextField } from '../../../components/forms/TextField';
import { ConfirmModal } from '../../../components/core/ConfirmModal';
import type { GameTemplate } from '../../../types';
import { TplTile } from './components/TplTile';
import { FormSection } from './components/FormSection';
import { PortRow } from './components/PortRow';
import { AddRowBtn } from './components/AddRowBtn';
import { EnvRow } from './components/EnvRow';
import { AvatarUploadField } from './components/AvatarUploadField';
import { BuildLogPanel } from './components/BuildLogPanel';
import { FormFooter } from './components/FormFooter';
import {
  RhfTextField,
  RhfSegmentedControl,
  RhfToggle,
  RhfDockerfileField,
} from './components/RhfFields';
import { useOtherGames } from './hooks/useOtherGames';
import { useGame } from './hooks/useGame';
import { useGameDockerfile } from './hooks/useGameDockerfile';
import { useSaveGame } from './hooks/useSaveGame';
import { useDeleteGame } from './hooks/useDeleteGame';
import { useExportGame } from './hooks/useExportGame';
import { BLANK_FORM_VALUES, gameToFormValues, templateToFormValues } from './formSchema';

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

export default function GameForm() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { hasPermission } = useAuth();
  const canSave = hasPermission(isEdit ? 'games:edit' : 'games:create');
  const navigate = useNavigate();

  const { control, getValues, setValue, reset, formState } = useForm({
    defaultValues: BLANK_FORM_VALUES,
  });
  const portsArray = useFieldArray({ control, name: 'ports' });
  const envArray = useFieldArray({ control, name: 'envVars' });

  // Reactive reads for the handful of fields that drive conditional UI or
  // get shown outside their own Controller (everything else stays
  // uncontrolled-from-index.tsx's perspective — Controller/useFieldArray own it).
  const watchedName = useWatch({ control, name: 'name' });
  const watchedSlug = useWatch({ control, name: 'slug' });
  const imageSource = useWatch({ control, name: 'imageSource' });
  const queryType = useWatch({ control, name: 'queryType' });
  const rconEnabled = useWatch({ control, name: 'rconEnabled' });

  const [idTouched, setIdTouched] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  // Avatar changes aren't part of the RHF-managed values (they're a separate
  // multipart upload step, not JSON form data), so formState.isDirty can't see
  // them — this fills that one gap alongside it.
  const [avatarDirty, setAvatarDirty] = useState(false);

  const [activeTpl, setActiveTpl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState<(() => void) | null>(null);

  const dirty = formState.isDirty || avatarDirty;

  function guardLeave(go: () => void) {
    if (dirty) setConfirmLeave(() => go);
    else go();
  }

  const [savedId, setSavedId] = useState<string | null>(isEdit ? id : null);
  const { status: buildStatus, log: buildLog, startBuild } = useBuildLog(savedId);

  const otherGamesQuery = useOtherGames();
  const otherGames = (otherGamesQuery.data ?? []).filter((g) => g.id !== id);

  const gameQuery = useGame(id, isEdit);
  const dockerfileQuery = useGameDockerfile(id, isEdit && gameQuery.data?.imageSource === 'local');
  const saveGame = useSaveGame();
  const deleteGame = useDeleteGame();
  const exportGame = useExportGame();
  const saving = saveGame.isPending || deleteGame.isPending || exportGame.isPending;

  useEffect(() => {
    const game = gameQuery.data;
    if (!game) return;
    reset(gameToFormValues(game));
    setAvatarPreview(game.avatar ? `/api/servers/${id}/avatar?v=${game.avatarVersion ?? 0}` : null);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarDirty(false);
  }, [gameQuery.data, id, reset]);

  useEffect(() => {
    if (dockerfileQuery.data) setValue('dockerfile', dockerfileQuery.data.content ?? '');
  }, [dockerfileQuery.data, setValue]);

  useEffect(() => {
    if (gameQuery.isError) setError(t('gameForm.errLoadFailed'));
  }, [gameQuery.isError, t]);

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
    setAvatarDirty(true);
  }

  function handleRemoveAvatar() {
    setAvatarError('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    setAvatarDirty(true);
  }

  function applyTemplate(tpl: GameTemplate) {
    // cpuLimit/memoryLimit are deliberately carried over rather than reset —
    // see templateToFormValues.
    const current = getValues();
    reset(
      {
        ...templateToFormValues(tpl),
        cpuLimit: current.cpuLimit,
        memoryLimit: current.memoryLimit,
      },
      { keepDefaultValues: true }
    );
    setActiveTpl(tpl.id);
    setIdTouched(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
    setAvatarDirty(false);
    setAvatarError('');
  }

  function handleNameChange(v: string) {
    setValue('name', v, { shouldDirty: true });
    if (!idTouched) setValue('slug', slugify(v), { shouldDirty: true });
  }

  function handleSlugChange(v: string) {
    setIdTouched(true);
    setValue('slug', v, { shouldDirty: true });
  }

  function handleSave(buildAfter = false) {
    setError('');
    const values = getValues();

    if (!values.name.trim()) {
      setError(t('gameForm.errNameRequired'));
      return;
    }
    if (!values.slug.trim()) {
      setError(t('gameForm.errIdRequired'));
      return;
    }
    if (!/^[a-z0-9-]+$/.test(values.slug)) {
      setError(t('gameForm.errIdInvalid'));
      return;
    }
    if (!values.image.trim()) {
      setError(t('gameForm.errImageRequired'));
      return;
    }

    for (const p of values.ports) {
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

    if (values.cpuLimit.trim()) {
      const v = parseFloat(values.cpuLimit);
      if (isNaN(v) || v <= 0) {
        setError(t('gameForm.errCpuInvalid'));
        return;
      }
    }
    if (values.memoryLimit.trim()) {
      const v = parseInt(values.memoryLimit, 10);
      if (isNaN(v) || v < 128) {
        setError(t('gameForm.errMemoryInvalid'));
        return;
      }
    }
    if (values.rconEnabled) {
      const p = Number(values.rconPort);
      if (!values.rconPort || !Number.isInteger(p) || p < 1 || p > 65535) {
        setError(t('gameForm.errRconPort'));
        return;
      }
      if (!values.rconPassword.trim()) {
        setError(t('gameForm.errRconPassword'));
        return;
      }
    }

    const gameData = {
      id: values.slug,
      name: values.name.trim(),
      description: values.description.trim(),
      imageSource: values.imageSource,
      image: values.image.trim(),
      storeUrl: values.storeUrl.trim() || null,
      dataMount: values.dataMount.trim() || '/data',
      query:
        values.queryType === 'a2s' && values.queryPort
          ? { type: 'a2s', port: Number(values.queryPort) }
          : null,
      ports: values.ports
        .filter((p) => p.host && p.container)
        .map((p) => ({
          host: Number(p.host),
          container: Number(p.container),
          protocol: p.protocol,
        })),
      environment: values.envVars
        .filter((e) => e.key.trim())
        .map((e) => ({ key: e.key.trim(), value: e.value, pinned: !!e.pinned })),
      resources: {
        cpuLimit: values.cpuLimit.trim() ? parseFloat(values.cpuLimit) : null,
        memoryLimit: values.memoryLimit.trim() ? parseInt(values.memoryLimit, 10) : null,
      },
      rcon: values.rconEnabled
        ? {
            enabled: true,
            port: Number(values.rconPort),
            password: values.rconPassword.trim(),
            listCommand: values.rconListCommand.trim() || undefined,
            commands: values.rconBroadcastCmd.trim()
              ? { broadcast: values.rconBroadcastCmd.trim() }
              : undefined,
          }
        : { enabled: false },
    };

    saveGame.mutate(
      {
        isEdit,
        id,
        slug: values.slug,
        gameData,
        dockerfile: values.dockerfile,
        imageSource: values.imageSource,
        avatarFile,
        removeAvatar,
        buildAfter,
        onConfigSaved: () => {
          // The config record is saved past this point — dockerfile/avatar/build
          // substeps below can still fail, but there's nothing left to "discard".
          reset(getValues());
          setAvatarDirty(false);
        },
      },
      {
        onSuccess: (result) => {
          if (!result.built) {
            navigate(`/admin/servers/${id ?? values.slug}`);
            return;
          }
          setSavedId(result.targetId);
          startBuild();
        },
        onError: (err) => {
          setError(err instanceof Error && err.message ? err.message : t('gameForm.errSaveFailed'));
        },
      }
    );
  }

  function handleDelete() {
    if (!id) return;
    setError('');
    deleteGame.mutate(id, {
      onSuccess: () => navigate('/admin'),
      onError: (err) => {
        setError(err instanceof Error && err.message ? err.message : t('gameForm.errDeleteFailed'));
      },
    });
  }

  function handleExport() {
    if (!id) return;
    setError('');
    exportGame.mutate(id, {
      onError: (err) => {
        setError(err instanceof Error && err.message ? err.message : t('gameForm.errExportFailed'));
      },
    });
  }

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const isLocalImage = imageSource === 'local';
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
          onClick={() =>
            guardLeave(() => (id ? navigate(`/admin/servers/${id}`) : navigate('/admin')))
          }
          className="inline-flex items-center gap-1.5 bg-bg-2 border border-line-2 text-ink-2 px-3 py-2 font-mono text-xs cursor-pointer hover:text-ink"
        >
          <ChevronLeft width={12} height={12} />
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
              <div className="flex items-center gap-2 font-mono tracking-widest uppercase text-ink-3 mb-3">
                <Blocks width={13} height={13} />
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
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <TextField
                    label={t('gameForm.fieldName')}
                    placeholder="e.g. Valheim"
                    value={field.value}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <Controller
                control={control}
                name="slug"
                render={({ field }) => (
                  <TextField
                    label={t('gameForm.fieldIdSlug')}
                    hint={isEdit ? t('gameForm.hintLocked') : t('gameForm.hintAuto')}
                    mono
                    placeholder="valheim"
                    value={field.value}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    onBlur={field.onBlur}
                    disabled={isEdit}
                  />
                )}
              />
            </div>
            <RhfTextField
              control={control}
              name="description"
              label={t('gameForm.fieldDescription')}
              hint={t('gameForm.hintOptional')}
              textarea
              placeholder={t('gameForm.placeholderDesc')}
              className="mt-4"
            />
          </FormSection>

          <FormSection
            title={t('gameForm.presentationTitle')}
            desc={t('gameForm.presentationDesc')}
          >
            <div className="grid grid-cols-[120px_1fr] gap-[14px_18px] items-start">
              <AvatarUploadField
                name={watchedName}
                slug={watchedSlug}
                avatarPreview={avatarPreview}
                avatarError={avatarError}
                onFileChange={handleAvatarChange}
                onRemove={handleRemoveAvatar}
              />
              <RhfTextField
                control={control}
                name="storeUrl"
                label={t('gameForm.fieldStoreUrl')}
                hint={t('gameForm.hintStoreUrl')}
                mono
                placeholder="https://store.steampowered.com/app/…"
              />
            </div>
          </FormSection>

          <FormSection title={t('gameForm.imageTitle')} desc={t('gameForm.imageDesc')}>
            <RhfSegmentedControl control={control} name="imageSource" options={imgSrcOptions} />

            {!isLocalImage && (
              <div className="mt-4 grid grid-cols-[1fr_200px] gap-[14px_18px]">
                <RhfTextField
                  control={control}
                  name="image"
                  label={t('gameForm.fieldDockerImage')}
                  mono
                  placeholder={t('gameForm.placeholderDockerImage')}
                />
                <RhfTextField
                  control={control}
                  name="dataMount"
                  label={t('gameForm.fieldDataPath')}
                  hint={t('gameForm.hintSavesGo')}
                  mono
                  placeholder="/data"
                />
              </div>
            )}

            {isLocalImage && (
              <>
                <div className="mt-4 grid grid-cols-[1fr_200px] gap-[14px_18px]">
                  <RhfTextField
                    control={control}
                    name="image"
                    label={t('gameForm.fieldBuiltImage')}
                    hint={t('gameForm.hintImageTag')}
                    mono
                    placeholder={t('gameForm.placeholderBuiltImage')}
                  />
                  <RhfTextField
                    control={control}
                    name="dataMount"
                    label={t('gameForm.fieldDataPath')}
                    hint={t('gameForm.hintSavesGo')}
                    mono
                    placeholder="/data"
                  />
                </div>
                <RhfDockerfileField
                  control={control}
                  label={t('gameForm.fieldDockerfile')}
                  placeholder={
                    isEdit
                      ? t('gameForm.placeholderKeepDockerfile')
                      : t('gameForm.placeholderNewDockerfile')
                  }
                  className="mt-4"
                />

                <BuildLogPanel
                  buildStatus={buildStatus}
                  buildLog={buildLog}
                  onGoToDashboard={() => navigate('/admin')}
                />
              </>
            )}
          </FormSection>

          <FormSection title={t('gameForm.resourcesTitle')} desc={t('gameForm.resourcesDesc')}>
            <div className="grid grid-cols-2 gap-4">
              <RhfTextField
                control={control}
                name="cpuLimit"
                label={t('gameForm.fieldCpuLimit')}
                hint={t('gameForm.hintCores')}
                mono
                type="number"
                step="0.1"
                min="0.1"
                placeholder="1"
              />
              <RhfTextField
                control={control}
                name="memoryLimit"
                label={t('gameForm.fieldMemoryLimit')}
                hint={t('gameForm.hintMB')}
                mono
                type="number"
                step="1"
                min="128"
                placeholder="1024"
              />
            </div>
          </FormSection>

          <FormSection title={t('gameForm.portsTitle')} desc={t('gameForm.portsDesc')}>
            {portsArray.fields.length > 0 && (
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
                return portsArray.fields.map((field, i) => (
                  <PortRow
                    key={field.id}
                    port={field}
                    idx={i}
                    onChange={(idx, key, value) =>
                      portsArray.update(idx, { ...portsArray.fields[idx], [key]: value })
                    }
                    onRemove={portsArray.remove}
                    conflictsWith={
                      field.host ? takenMap.get(`${field.host}/${field.protocol}`) : undefined
                    }
                  />
                ));
              })()}
            </div>

            <AddRowBtn
              onClick={() => portsArray.append({ host: '', container: '', protocol: 'tcp' })}
              label={t('gameForm.addPort')}
            />
          </FormSection>

          <FormSection title={t('gameForm.envTitle')} desc={t('gameForm.envDesc')}>
            {envArray.fields.length > 0 && (
              <div className="grid gap-2 mb-2 grid-cols-[1fr_1.4fr_34px_34px]">
                {[t('gameForm.envKey'), t('gameForm.envValue'), '', ''].map((h, i) => (
                  <span key={i} className="font-mono text-sm tracking-[.06em] uppercase text-ink-3">
                    {h}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {envArray.fields.map((field, i) => (
                <EnvRow
                  key={field.id}
                  env={field}
                  idx={i}
                  onChange={(idx, key, value) =>
                    envArray.update(idx, { ...envArray.fields[idx], [key]: value })
                  }
                  onRemove={envArray.remove}
                  pinnedLabel={t('gameForm.envPinned')}
                  pinLabel={t('gameForm.envPin')}
                />
              ))}
            </div>
            <AddRowBtn
              onClick={() => envArray.append({ key: '', value: '' })}
              label={t('gameForm.addVar')}
            />
          </FormSection>

          <FormSection title={t('gameForm.queryTitle')} desc={t('gameForm.queryDesc')}>
            <RhfSegmentedControl
              control={control}
              name="queryType"
              options={[
                { label: t('gameForm.queryNone'), value: 'none' },
                { label: t('gameForm.queryA2s'), value: 'a2s' },
              ]}
            />
            {queryType === 'a2s' && (
              <RhfTextField
                control={control}
                name="queryPort"
                label={t('gameForm.fieldQueryPort')}
                hint={t('gameForm.hintA2sPort')}
                mono
                placeholder="27015"
                className="mt-4 max-w-50"
                type="number"
                min="1"
                max="65535"
              />
            )}
          </FormSection>

          <FormSection title={t('gameForm.rconTitle')} desc={t('gameForm.rconDesc')}>
            <RhfToggle control={control} label={t('gameForm.rconEnabled')} />
            {rconEnabled && (
              <div className="grid grid-cols-2 gap-[14px_18px] mt-4">
                <RhfTextField
                  control={control}
                  name="rconPort"
                  label={t('gameForm.fieldRconPort')}
                  mono
                  type="number"
                  min="1"
                  max="65535"
                  placeholder="25575"
                />
                <RhfTextField
                  control={control}
                  name="rconPassword"
                  label={t('gameForm.fieldRconPass')}
                  mono
                  type="password"
                  placeholder="••••••••"
                />
                <RhfTextField
                  control={control}
                  name="rconListCommand"
                  label={t('gameForm.fieldRconListCommand')}
                  hint={t('gameForm.hintRconListCommand')}
                  mono
                  placeholder="list"
                  className="col-span-2"
                />
                <RhfTextField
                  control={control}
                  name="rconBroadcastCmd"
                  label={t('gameForm.fieldRconBroadcastCmd')}
                  hint={t('gameForm.hintRconBroadcastCmd')}
                  mono
                  placeholder="say {message}"
                  className="col-span-2"
                />
              </div>
            )}
          </FormSection>
        </div>
      </div>

      <FormFooter
        isEdit={isEdit}
        canDelete={hasPermission('games:delete')}
        canSave={canSave}
        saving={saving}
        buildRunning={buildRunning}
        isLocalImage={isLocalImage}
        error={error}
        onDelete={() => setConfirmDelete(true)}
        onExport={handleExport}
        onCancel={() => guardLeave(() => navigate('/admin'))}
        onSave={() => handleSave(false)}
        onSaveAndBuild={() => handleSave(true)}
      />

      {confirmDelete && (
        <ConfirmModal
          title={t('gameForm.deleteTitle')}
          message={t('gameForm.deleteMessage', { name: getValues('name'), id })}
          confirmLabel={t('gameForm.deleteConfirm')}
          onConfirm={() => {
            setConfirmDelete(false);
            handleDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmLeave && (
        <ConfirmModal
          title={t('gameForm.discardTitle')}
          message={t('gameForm.discardMessage')}
          confirmLabel={t('gameForm.discardConfirm')}
          onConfirm={() => {
            const go = confirmLeave;
            setConfirmLeave(null);
            go();
          }}
          onCancel={() => setConfirmLeave(null)}
        />
      )}
    </div>
  );
}
