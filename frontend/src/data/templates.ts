export const templates = [
  {
    id: 'minecraft',
    name: 'Minecraft',
    description: 'Java Edition survival server',
    imageSource: 'public',
    image: 'itzg/minecraft-server',
    dataMount: '/data',
    ports: [{ host: 25565, container: 25565, protocol: 'tcp' }],
    environment: [
      { key: 'EULA', value: 'TRUE' },
      { key: 'MEMORY', value: '4G' },
      { key: 'MODE', value: 'survival' },
    ],
    rcon: { enabled: true, port: 25575, password: 'changeme' },
  },
  {
    id: 'valheim',
    name: 'Valheim',
    description: 'Viking survival server',
    imageSource: 'public',
    image: 'lloesche/valheim-server',
    dataMount: '/config',
    query: { type: 'a2s', port: 2457 },
    ports: [
      { host: 2456, container: 2456, protocol: 'udp' },
      { host: 2457, container: 2457, protocol: 'udp' },
      { host: 2458, container: 2458, protocol: 'udp' },
    ],
    environment: [
      { key: 'SERVER_NAME', value: 'My Valheim Server' },
      { key: 'WORLD_NAME', value: 'Dedicated' },
      { key: 'SERVER_PASS', value: 'changeme' },
    ],
    rcon: { enabled: false },
  },
  {
    id: 'terraria',
    name: 'Terraria',
    description: 'Terraria dedicated server',
    imageSource: 'public',
    image: 'ryshe/terraria',
    dataMount: '/world',
    ports: [{ host: 7777, container: 7777, protocol: 'tcp' }],
    environment: [{ key: 'WORLD', value: 'world1' }],
    rcon: { enabled: false },
  },
  {
    id: 'factorio',
    name: 'Factorio',
    description: 'Factorio dedicated server',
    imageSource: 'public',
    image: 'factoriotools/factorio',
    dataMount: '/factorio',
    ports: [{ host: 34197, container: 34197, protocol: 'udp' }],
    environment: [],
    rcon: { enabled: false },
  },
  {
    id: 'cs2',
    name: 'CS2',
    description: 'Counter-Strike 2 dedicated server',
    imageSource: 'local',
    image: 'serverdock-cs2',
    imageBuilt: false,
    query: { type: 'a2s', port: 27015 },
    ports: [
      { host: 27015, container: 27015, protocol: 'tcp' },
      { host: 27015, container: 27015, protocol: 'udp' },
    ],
    environment: [{ key: 'STEAM_APP_ID', value: '730' }],
    rcon: { enabled: true, port: 27015, password: 'changeme' },
    dockerfileTemplate: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl lib32gcc-s1
RUN curl -sqL "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" | tar zxvf - -C /usr/local/bin
WORKDIR /server
RUN steamcmd +login anonymous +app_update 730 validate +quit
EXPOSE 27015/tcp 27015/udp
CMD ["./game/bin/linuxsteamrt64/cs2", "-dedicated"]`,
  },
  {
    id: 'ark',
    name: 'ARK',
    description: 'ARK: Survival Evolved dedicated server',
    imageSource: 'local',
    image: 'serverdock-ark',
    imageBuilt: false,
    query: { type: 'a2s', port: 27015 },
    ports: [{ host: 7777, container: 7777, protocol: 'udp' }],
    environment: [{ key: 'STEAM_APP_ID', value: '376030' }],
    rcon: { enabled: true, port: 27020, password: 'changeme' },
    dockerfileTemplate: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl lib32gcc-s1
RUN curl -sqL "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" | tar zxvf - -C /usr/local/bin
WORKDIR /server
RUN steamcmd +login anonymous +app_update 376030 validate +quit
EXPOSE 7777/udp
CMD ["/server/ShooterGame/Binaries/Linux/ShooterGameServer", "TheIsland"]`,
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Rust dedicated server',
    imageSource: 'local',
    image: 'serverdock-rust',
    imageBuilt: false,
    query: { type: 'a2s', port: 28015 },
    ports: [{ host: 28015, container: 28015, protocol: 'udp' }],
    environment: [{ key: 'STEAM_APP_ID', value: '258550' }],
    rcon: { enabled: true, port: 28016, password: 'changeme' },
    dockerfileTemplate: `FROM ubuntu:22.04
RUN apt-get update && apt-get install -y curl lib32gcc-s1
RUN curl -sqL "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz" | tar zxvf - -C /usr/local/bin
WORKDIR /server
RUN steamcmd +login anonymous +app_update 258550 validate +quit
EXPOSE 28015/udp
CMD ["/server/RustDedicated", "-batchmode"]`,
  },
];
