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
  rcon?: { enabled: boolean; port?: number | null; password?: string };
  startedAt?: string | null;
  lastActiveAt?: string | null;
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

export interface Visitor {
  id: string;
  username: string;
  ip?: string;
  firstSeen?: string;
  lastSeen?: string;
  blocked: boolean;
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

export interface VpnPeer {
  id: string;
  name: string;
  ip?: string;
  os?: string;
  online: boolean;
  lastSeen?: string;
}

export interface VpnStatus {
  self?: VpnSelf;
  peers: VpnPeer[];
  provider?: string;
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
  rcon?: { enabled: boolean; port?: number; password?: string };
}
