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
    static selectedtoken = "";

    static init() {
        //CONFIG.debug.hooks = true;
        AlwaysHP.app = new AlwaysHPApp().render(true);
        log('rendering app');
    }

    static changeHP(value) {
        //CONFIG.debug.hooks = true;
        return Promise.all(canvas.tokens.controlled.map(t => {
            const a = t.actor; //game.actors.get(t.actor.id);

            if (value == 'dead') {
                //set hp to 0 and add the death effect
                log('setting dead', a);
                let status = CONFIG.statusEffects.find(e => e.id === CONFIG.Combat.defeatedStatusId);
                let effect = a && status ? status : CONFIG.controlIcons.defeated;
                t.toggleEffect(effect, { overlay: true, active: true });
                if (game.system.id == "dnd5e") {
                    a.applyDamage(a.data.data.attributes.hp.value).then(() => {
                        AlwaysHP.refreshSelected();
                    });
                } else {
                    AlwaysHP.applyDamage(a, a.data.data.attributes.hp.value).then(() => {
                        AlwaysHP.refreshSelected();
                    });
                }
            } else {
                let hp = a.data.data.attributes.hp;
                let val = value;
                if (value == 'full') {
                    val = (hp.value - hp.max);
                }

                log('applying damage', a, val);
                if (game.system.id == "dnd5e") {
                    a.applyDamage(val).then(() => {
                        AlwaysHP.refreshSelected();
                    });
                } else {
                    AlwaysHP.applyDamage(a, val).then(() => {
                        AlwaysHP.refreshSelected();
                    });
                }
            }
        }));
    }

    static async applyDamage(actor, amount = 0, multiplier = 1) {
        amount = Math.floor(parseInt(amount) * multiplier);
        const hp = actor.data.data.attributes.hp;

        // Deduct damage from temp HP first
        const tmp = parseInt(hp.temp) || 0;
        const dt = amount > 0 ? Math.min(tmp, amount) : 0;

        // Remaining goes to health
        const tmpMax = parseInt(hp.tempmax) || 0;
        const dh = Math.clamped(hp.value - (amount - dt), 0, hp.max + tmpMax);

        // Update the Actor
        const updates = {
            "data.attributes.hp.temp": tmp - dt,
            "data.attributes.hp.value": dh
        };

        return actor.update(updates);
    }

    static refreshSelected() {
        if (canvas.tokens.controlled.length == 0)
            AlwaysHP.selectedtoken = "";
        else if (canvas.tokens.controlled.length == 1)
            AlwaysHP.selectedtoken = canvas.tokens.controlled[0].data.name + " [" + canvas.tokens.controlled[0].actor.data.data.attributes.hp.value + "]";
        else
            AlwaysHP.selectedtoken = "Multiple (" + canvas.tokens.controlled.length + ")";
        AlwaysHP.app.changeToken(AlwaysHP.selectedtoken);
    }
}

export class AlwaysHPApp extends Application {

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "alwayshp-app";
        options.template = "modules/always-hp/templates/alwayshp.html";
        options.popOut = false;
        options.resizable = false;
        return options;
    }

    getData() {
        return {
            selectedtoken: AlwaysHP.selectedtoken
        };
    }

    show() {
        log('showing');
        $(this.element).removeClass('loading').css({ display: 'flex !important' });
    }

    setPos(pos) {
        log('set pos', pos);
        this.setPosition(pos.left, pos.top);

        let elmnt = this.element;
        let xPos = (pos.left) > window.innerWidth ? window.innerWidth - 200 : pos.left;
        let yPos = (pos.top) > window.innerHeight - 20 ? window.innerHeight - 100 : pos.top;
        $(elmnt).css({left:xPos, top:yPos});
        log('set pos complete', pos);

        return this;
    }

    loadSettings() {
        let resourcename = game.settings.get('always-hp', 'resourcename');
    }

    changeToken(display) {
        $('#selected-characters', this.element).html(display);
    }

    get getValue() {
        return $('#alwayshp-hp', this.element).val();
    }

    clearInput() {
        $('#alwayshp-hp', this.element).val('');
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            log('set character to dead');
            AlwaysHP.changeHP('dead');
            this.clearInput();
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
            let value = this.getValue;
            if(value != '') AlwaysHP.changeHP(value);
            this.clearInput();
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
            let value = this.getValue;
            if (value != '') AlwaysHP.changeHP(-value);
            this.clearInput();
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
            AlwaysHP.changeHP('full');
            this.clearInput();
        });
        html.find('#alwayshp-hp').focus(ev => {
            ev.preventDefault();
            let elem = ev.target;
            if (elem.setSelectionRange) {
                elem.focus();
                elem.setSelectionRange(0, $(elem).val().length);
            } else if (elem.createTextRange) {
                var range = elem.createTextRange();
                range.collapse(true);
                range.moveEnd('character', $(elem).val().length);
                range.moveStart('character', 0);
                range.select();
            }
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
            }
        });
    }
}

Hooks.on('ready', () => {
    AlwaysHP.init();
});

Hooks.on('renderAlwaysHPApp', () => {
    if (game.user.data.flags.alwayshp) {
        let pos = game.user.data.flags.alwayshp.alwayshpPos;
        log('setting position', pos);
        AlwaysHP.app.setPos(pos);
    }
    AlwaysHP.app.show();
});

Hooks.on('controlToken', AlwaysHP.refreshSelected);
