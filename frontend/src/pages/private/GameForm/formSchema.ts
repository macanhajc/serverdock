import type { PortFormRow, EnvVarRow, GameTemplate } from '../../../types';
import type { GameRecord } from './hooks/useGame';

export interface GameFormValues {
  name: string;
  slug: string;
  description: string;
  imageSource: string;
  image: string;
  dataMount: string;
  dockerfile: string;
  ports: PortFormRow[];
  envVars: EnvVarRow[];
  storeUrl: string;
  queryType: string;
  queryPort: string;
  cpuLimit: string;
  memoryLimit: string;
  rconEnabled: boolean;
  rconPort: string;
  rconPassword: string;
  rconListCommand: string;
  rconBroadcastCmd: string;
}

export const BLANK_FORM_VALUES: GameFormValues = {
  name: '',
  slug: '',
  description: '',
  imageSource: 'public',
  image: '',
  dataMount: '/data',
  dockerfile: '',
  ports: [],
  envVars: [],
  storeUrl: '',
  queryType: 'none',
  queryPort: '',
  cpuLimit: '',
  memoryLimit: '',
  rconEnabled: false,
  rconPort: '',
  rconPassword: '',
  rconListCommand: '',
  rconBroadcastCmd: '',
};

// dockerfile is intentionally left blank here — it's hydrated separately
// once useGameDockerfile resolves (see index.tsx), since it's a second,
// conditional fetch that lands after the game record itself.
export function gameToFormValues(game: GameRecord): GameFormValues {
  return {
    name: game.name,
    slug: game.id,
    description: game.description ?? '',
    imageSource: game.imageSource ?? 'public',
    image: game.image ?? '',
    dataMount: game.dataMount ?? '/data',
    dockerfile: '',
    ports: (game.ports ?? []).map((p) => ({
      ...p,
      host: String(p.host),
      container: String(p.container),
    })),
    envVars: game.environment ?? [],
    storeUrl: game.storeUrl ?? '',
    queryType: game.query?.type ?? 'none',
    queryPort: game.query?.port ? String(game.query.port) : '',
    cpuLimit: game.resources?.cpuLimit != null ? String(game.resources.cpuLimit) : '',
    memoryLimit: game.resources?.memoryLimit != null ? String(game.resources.memoryLimit) : '',
    rconEnabled: !!game.rcon?.enabled,
    rconPort: game.rcon?.port ? String(game.rcon.port) : '',
    rconPassword: game.rcon?.password ?? '',
    rconListCommand: game.rcon?.listCommand ?? '',
    rconBroadcastCmd: game.rcon?.commands?.broadcast ?? '',
  };
}

// name/slug/storeUrl reset to blank (a template isn't a saved game, it's a
// starting point) and cpuLimit/memoryLimit are deliberately NOT part of this
// — the original form left whatever the admin had already typed there alone
// across a template switch, and this preserves that.
export function templateToFormValues(
  tpl: GameTemplate
): Omit<GameFormValues, 'cpuLimit' | 'memoryLimit'> {
  return {
    name: '',
    slug: '',
    description: tpl.description ?? '',
    imageSource: tpl.imageSource ?? 'public',
    image: tpl.image ?? '',
    dataMount: tpl.dataMount ?? '/data',
    dockerfile: tpl.dockerfileTemplate ?? '',
    ports: (tpl.ports ?? []).map((p) => ({
      ...p,
      host: String(p.host),
      container: String(p.container),
    })),
    envVars: tpl.environment ?? [],
    storeUrl: '',
    queryType: tpl.query?.type ?? 'none',
    queryPort: tpl.query?.port ? String(tpl.query.port) : '',
    rconEnabled: !!tpl.rcon?.enabled,
    rconPort: tpl.rcon?.port ? String(tpl.rcon.port) : '',
    rconPassword: tpl.rcon?.password ?? '',
    rconListCommand: '',
    rconBroadcastCmd: tpl.rcon?.commands?.broadcast ?? '',
  };
}
