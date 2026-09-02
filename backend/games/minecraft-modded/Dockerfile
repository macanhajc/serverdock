# Modded Minecraft, built from a Dockerfile instead of pulled from a public
# image — this bakes your mods into the image itself so the server starts
# clean and works offline, rather than downloading a modpack every launch.
#
# To use:
#   1. Drop your Fabric/Forge mod .jar files into this game's mods/ folder
#      (backend/games/minecraft-modded/mods/) — see mods/README.md.
#   2. Match the TYPE/VERSION environment variables (in this game's config)
#      to whatever your modpack targets.
#   3. Click "Save & Build" in the game editor, or "Rebuild" on the server's
#      Info tab, whenever you change the mods folder.
FROM itzg/minecraft-server:java21

COPY mods/ /mods/
