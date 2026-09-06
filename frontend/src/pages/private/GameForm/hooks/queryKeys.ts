export const gameFormKeys = {
  otherGames: ['gameForm', 'otherGames'] as const,
  game: (id: string | undefined) => ['gameForm', 'game', id] as const,
  dockerfile: (id: string | undefined) => ['gameForm', 'dockerfile', id] as const,
};
