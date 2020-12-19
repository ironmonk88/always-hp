let modulename = "always-hp";

game.settings.register(modulename, "resourcename", {
    name: game.i18n.localize("ALWAYSHP.ResourceTitle"),
    hint: game.i18n.localize("ALWAYSHP.ResourceHint"),
    scope: "world",
    default: "attributes.hp",
    type: String,
    config: true
});