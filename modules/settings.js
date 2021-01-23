export const registerSettings = function () {
    let modulename = "always-hp";

    game.settings.register(modulename, "resourcename", {
        name: game.i18n.localize("ALWAYSHP.ResourceTitle"),
        hint: game.i18n.localize("ALWAYSHP.ResourceHint"),
        scope: "world",
        default: "attributes.hp",
        type: String,
        config: false
    });

    game.settings.register(modulename, "add-defeated", {
        name: game.i18n.localize("ALWAYSHP.DefeatedTitle"),
        hint: game.i18n.localize("ALWAYSHP.DefeatedHint"),
        scope: "world",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "show-dialog", {
        name: game.i18n.localize("ALWAYSHP.ShowDialogTitle"),
        hint: game.i18n.localize("ALWAYSHP.ShowDialogHint"),
        scope: "client",
        default: true,
        type: Boolean,
        config: true
    });
}