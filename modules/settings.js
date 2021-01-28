export const registerSettings = function () {
    let modulename = "always-hp";

    game.settings.register(modulename, "resourcename", {
        name: game.i18n.localize("ALWAYSHP.ResourceTitle"),
        hint: game.i18n.localize("ALWAYSHP.ResourceHint"),
        scope: "world",
        default: "attributes.hp",
        type: String,
        config: true
    });

    game.settings.register(modulename, "add-defeated", {
        name: game.i18n.localize("ALWAYSHP.DefeatedTitle"),
        hint: game.i18n.localize("ALWAYSHP.DefeatedHint"),
        scope: "world",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "clear-savingthrows", {
        name: game.i18n.localize("ALWAYSHP.ClearSavingThrows"),
        hint: game.i18n.localize("ALWAYSHP.ClearSavingThrowsHint"),
        scope: "world",
        default: true,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "double-click", {
        name: game.i18n.localize("ALWAYSHP.AllowDoubleClick"),
        hint: game.i18n.localize("ALWAYSHP.AllowDoubleClickHint"),
        scope: "client",
        default: false,
        type: Boolean,
        config: true
    });

    game.settings.register(modulename, "gm-only", {
        name: game.i18n.localize("ALWAYSHP.GMOnlyTitle"),
        hint: game.i18n.localize("ALWAYSHP.GMOnlyHint"),
        scope: "world",
        default: false,
        type: Boolean,
        config: true
    });

    if (game.user.isGM || !game.settings.get("always-hp", "gm-only")){
        game.settings.register(modulename, "show-dialog", {
            name: game.i18n.localize("ALWAYSHP.ShowDialogTitle"),
            hint: game.i18n.localize("ALWAYSHP.ShowDialogHint"),
            scope: "client",
            default: true,
            type: Boolean,
            config: true
        });
    }
}