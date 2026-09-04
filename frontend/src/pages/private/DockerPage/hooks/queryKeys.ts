// Central query keys for the DockerPage — kept in one place so invalidation
// call sites (mutations) can't drift from what the query hooks actually use.
export const dockerKeys = {
  images: ['docker', 'images'] as const,
  containers: ['docker', 'containers'] as const,
  summary: ['docker', 'summary'] as const,
  imageDetail: (id: string) => ['docker', 'imageDetail', id] as const,
  containerDetail: (id: string) => ['docker', 'containerDetail', id] as const,
};
