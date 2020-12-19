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

export class AlwaysHP {
    static app = null;

    static init() {
        AlwaysHP.app = new AlwaysHPApp().render(true);
    }
}

export class AlwaysHPApp extends Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "alwayshp-app";
        options.template = "modules/always-hp/templates/alwayshp.html";
        options.popOut = false;
        options.width = 300;
        options.resizable = false;
        return options;
    }

    getData() {
        return {};
    }

    setPos(pos) {
        return new Promise(resolve => {
            function check() {
                let elmnt = document.getElementById("alwayshp-container");
                if (elmnt) {
                    elmnt.style.bottom = null;
                    let xPos = (pos.left) > window.innerWidth ? window.innerWidth - 200 : pos.left;
                    let yPos = (pos.top) > window.innerHeight - 20 ? window.innerHeight - 100 : pos.top;
                    elmnt.style.top = (yPos) + "px";
                    elmnt.style.left = (xPos) + "px";
                    elmnt.style.position = 'fixed';
                    elmnt.style.zIndex = 100;
                    resolve();
                } else {
                    setTimeout(check, 30);
                }
            }
            check();
        });
    }

    loadSettings() {
        let resourcename = game.settings.get('always-hp', 'resourcename');
    }

    static resetPos() {
        let pos = { bottom: 8, left: 15 }
        return new Promise(resolve => {
            function check() {
                let elmnt = document.getElementById("alwayshp-container");
                if (elmnt) {
                    log('Resetting Position');
                    elmnt.style.top = null;
                    elmnt.style.bottom = (pos.bottom) + "%";
                    elmnt.style.left = (pos.left) + "%";
                    game.user.update({ flags: { 'alwayshp': { 'alwayshpPos': { top: elmnt.offsetTop, left: elmnt.offsetLeft } } } });
                    elmnt.style.bottom = null;
                    resolve();
                } else {
                    setTimeout(check, 30);
                }
            }
            check();
        })
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            log('set character to dead');
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
        });
        html.find('#alwayshp-move-handle').mousedown(ev => {
            ev.preventDefault();
            ev = ev || window.event;
            let isRightMB = false;
            if ("which" in ev) { // Gecko (Firefox), WebKit (Safari/Chrome) & Opera
                isRightMB = ev.which == 3;
            } else if ("button" in ev) { // IE, Opera 
                isRightMB = ev.button == 2;
            }

            if (!isRightMB) {
                dragElement(document.getElementById("alwayshp-container"));
                let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

                function dragElement(elmnt) {
                    elmnt.onmousedown = dragMouseDown;
                    function dragMouseDown(e) {
                        e = e || window.event;
                        e.preventDefault();
                        pos3 = e.clientX;
                        pos4 = e.clientY;

                        document.onmouseup = closeDragElement;
                        document.onmousemove = elementDrag;
                    }

                    function elementDrag(e) {
                        e = e || window.event;
                        e.preventDefault();
                        // calculate the new cursor position:
                        pos1 = pos3 - e.clientX;
                        pos2 = pos4 - e.clientY;
                        pos3 = e.clientX;
                        pos4 = e.clientY;
                        // set the element's new position:
                        elmnt.style.bottom = null
                        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
                        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
                        elmnt.style.position = 'fixed';
                        elmnt.style.zIndex = 100;
                    }

                    function closeDragElement() {
                        // stop moving when mouse button is released:
                        elmnt.onmousedown = null;
                        document.onmouseup = null;
                        document.onmousemove = null;
                        let xPos = (elmnt.offsetLeft - pos1) > window.innerWidth ? window.innerWidth - 200 : (elmnt.offsetLeft - pos1);
                        let yPos = (elmnt.offsetTop - pos2) > window.innerHeight - 20 ? window.innerHeight - 100 : (elmnt.offsetTop - pos2)
                        xPos = xPos < 0 ? 0 : xPos;
                        yPos = yPos < 0 ? 0 : yPos;
                        if (xPos != (elmnt.offsetLeft - pos1) || yPos != (elmnt.offsetTop - pos2)) {
                            elmnt.style.top = (yPos) + "px";
                            elmnt.style.left = (xPos) + "px";
                        }
                        log(`Setting alwayshp position:`, xPos, xPos);
                        game.user.update({ flags: { 'alwayshp': { 'alwayshpPos': { top: yPos, left: xPos } } } });
                    }
                }
            } else if (isRightMB) {
                AlwaysHPApp.resetPos();
            }
        });
    }
}

Hooks.once('init', AlwaysHP.init);
Hooks.on('ready', () => {
    if (game.user.data.flags.alwayshp) {
        AlwaysHP.app.setPos(game.user.data.flags.alwayshp.alwayshpPos);
    }
});
/*
Hooks.on('ready', () => {
    renderTemplate("modules/always-hp/templates/alwaydhp.html", {}).then(html => {
        ahp.setPos(game.user.data.flags.alwayshp.alwayshpPos)
        ahp.render(true);
    });
});*/
