export type ContainerStatus =
  | 'not_created'
  | 'running'
  | 'stopped'
  | 'error'
  | 'starting'
  | 'stopping'
  | 'restarting'
  | 'pulling'
  | 'building';

export type UiStatus =
  | 'online'
  | 'offline'
  | 'error'
  | 'starting'
  | 'stopping'
  | 'pulling'
  | 'building';

export interface PullProgress {
  phase: 'downloading' | 'extracting' | string;
  percent: number;
}

export type Protocol = 'tcp' | 'udp' | string;

export interface Port {
  host: number;
  container: number;
  protocol: Protocol;
}

export interface EnvVar {
  key: string;
  value: string;
  pinned?: boolean;
}

export interface Connection {
  host: string;
  port: number;
}

export interface ResourceAlert {
  cpu: number;
  memPct: number;
  message: string;
  since: string;
}

export interface CrashInfo {
  exitCode: number | null;
  oomKilled: boolean;
  error: string | null;
  at: string;
}

export interface ActionFailureInfo {
  action: string;
  message: string;
  stack: string | null;
  at: string;
}

export type ServerEventEntry =
  | {
      id: number;
      type: 'resource_high';
      data: { cpu: number; memPct: number; message: string };
      createdAt: string;
      resolvedAt: string | null;
    }
  | {
      id: number;
      type: 'crash';
      data: { exitCode: number | null; oomKilled: boolean; error: string | null };
      createdAt: string;
      resolvedAt: string | null;
    }
  | {
      id: number;
      type: 'action_failed';
      data: { action: string; message: string; stack: string | null };
      createdAt: string;
      resolvedAt: string | null;
    };

export interface Server {
  id: string;
  name: string;
  image: string;
  avatarUrl?: string | null;
  storeUrl?: string | null;
  status: ContainerStatus;
  imageSource: 'public' | 'local';
  imageBuilt?: boolean;
  players: number | null;
  playerList?: string | null;
  resourceAlert?: ResourceAlert | null;
  lastCrash?: CrashInfo | null;
  actionFailure?: ActionFailureInfo | null;
  connection: Connection | null;
  pinnedEnv: EnvVar[];
  diskUsed?: number;
  ports?: Port[];
  description?: string;
  dataMount?: string;
  cpuLimit?: number | null;
  memoryLimit?: number | null;
  query?: { type: string; port?: number } | null;
  resources?: { cpuLimit?: number | null; memoryLimit?: number | null };
  environment?: EnvVar[];
  rcon?: {
    enabled: boolean;
    port?: number | null;
    password?: string;
    listCommand?: string;
    commands?: { broadcast?: string };
  };
  startedAt?: string | null;
  lastActiveAt?: string | null;
  maintenanceSoon?: { at: string; action: string } | null;
}

export interface ServerStats {
  cpu: number;
  memUsed: number;
  memLimit?: number;
  netInRate: number;
  netOutRate: number;
}

export interface HostDisk {
  used: number;
  total: number;
}

export type AdminRole = 'super_admin' | 'admin';

export type Permission =
  | 'servers:power'
  | 'servers:reset'
  | 'games:create'
  | 'games:edit'
  | 'games:delete'
  | 'files:write'
  | 'backups:manage'
  | 'console:write'
  | 'visitors:manage'
  | 'schedules:manage'
  | 'settings:manage';

export interface Admin {
  id: string;
  username: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
  // null means "all" — only super_admin rows carry a null permissions list
  permissions: Permission[] | null;
}

export interface Visitor {
  id: string;
  username: string;
  ip?: string;
  firstSeen?: string;
  lastSeen?: string;
  blocked: boolean;
  // Matched by IP against the current network provider's peer list — null
  // when the visitor's IP has no corresponding peer (e.g. the provider is
  // down/unconfigured, or the peer was removed since).
  peer?: { name: string; online: boolean; os?: string; lastSeen?: string } | null;
}

export interface BlockedIp {
  ip: string;
  blockedAt: string;
}

export interface VpnSelf {
  name: string;
  ip?: string;
  online: boolean;
}

export type VpnConnectionType = 'direct' | 'relayed';

export interface VpnPeer {
  id: string;
  name: string;
  ip?: string;
  os?: string;
  online: boolean;
  lastSeen?: string;
  latencyMs?: number | null;
  connectionType?: VpnConnectionType | null;
}

export type NetworkProviderId = 'netbird' | 'tailscale' | 'wireguard' | 'zerotier' | 'manual';

export interface VpnStatus {
  self?: VpnSelf;
  peers: VpnPeer[];
  provider?: NetworkProviderId;
}

export interface LogLine {
  ts: string;
  level: string;
  line: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string | null;
}

export interface OpenFile {
  path: string;
  name: string;
}

export type ScheduleAction = 'start' | 'stop' | 'restart' | 'command' | 'backup';

export interface BackupEntry {
  id: string;
  label?: string;
  createdAt: string;
  size: number;
}

export interface ScheduleEntry {
  id: string;
  label: string;
  action: ScheduleAction;
  cron: string;
  command?: string;
  timezone?: string;
  enabled: boolean;
  lastRun?: { at: string; ok: boolean };
  lastStatus?: string;
  nextRun?: string | null;
}

export interface ScheduleFormState {
  label: string;
  action: string;
  cron: string;
  command: string;
  timezone: string;
}

export interface RconEntry {
  seq: number;
  ts: string;
  command: string;
  response: string | null;
  error: string | null;
}

export interface PortFormRow {
  host: string;
  container: string;
  protocol: Protocol;
}

export interface EnvVarRow {
  key: string;
  value: string;
  pinned?: boolean;
}

export interface GameTemplate {
  id: string;
  name: string;
  description?: string;
  imageSource: 'public' | 'local' | string;
  image?: string;
  dockerfileTemplate?: string;
  dataMount?: string;
  dockerfile?: string;
  ports?: Array<{ host: number; container: number; protocol: Protocol }>;
  environment?: EnvVar[];
  query?: { type: string; port?: number };
  rcon?: {
    enabled: boolean;
    port?: number;
    password?: string;
    commands?: { broadcast?: string };
  };
}
