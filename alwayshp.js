import { registerSettings } from "./modules/settings.js";

export let debug = (...args) => {
    if (debugEnabled > 1) console.log("DEBUG: alwayshp | ", ...args);
};
export let log = (...args) => console.log("alwayshp | ", ...args);
export let warn = (...args) => {
    if (debugEnabled > 0) console.warn("alwayshp | ", ...args);
};
export let error = (...args) => console.error("alwayshp | ", ...args);
export let i18n = key => {
    return game.i18n.localize(key);
};

export class AlwaysHP extends Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = "modules/always-hp/templates/alwayshp.html";
        options.popOut = false;
        options.resizable = false;
        return options;
    }
}