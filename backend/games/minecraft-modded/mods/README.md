# Mods folder

Drop your Fabric or Forge mod `.jar` files directly into this folder before
building the image. They get baked in via `COPY mods/ /mods/` in the
Dockerfile, and `itzg/minecraft-server` picks up anything already present in
`/mods` at container start — no runtime download needed.

Keep the mods here in sync with the `TYPE` and `VERSION` environment
variables set on this game (Fabric mods need a Fabric-loader `VERSION`,
Forge mods need a Forge one — mixing them won't start).

After adding, removing, or updating mods, rebuild the image (GameForm's
"Save & Build", or the "Rebuild" button on this server's Info tab) for the
change to take effect — editing this folder alone doesn't touch a
already-built image.
