export const serverDetailKeys = {
  server: (id: string | undefined) => ['serverDetail', 'server', id] as const,
  events: (id: string | undefined) => ['serverDetail', 'events', id] as const,
  files: (id: string | undefined, path: string) => ['serverDetail', 'files', id, path] as const,
  fileContent: (id: string | undefined, path: string | undefined) =>
    ['serverDetail', 'fileContent', id, path] as const,
  schedules: (id: string | undefined) => ['serverDetail', 'schedules', id] as const,
  backups: (id: string | undefined) => ['serverDetail', 'backups', id] as const,
};
