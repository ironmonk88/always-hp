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
    //static selectedtoken = "";

    static init() {
        //CONFIG.debug.hooks = true;
        registerSettings();
        if ((game.user.isGM || !game.settings.get("always-hp", "gm-only")) && game.settings.get("always-hp", "show-dialog"))
            AlwaysHP.app = new AlwaysHPApp().render(true);
        log('rendering app');
    }

/*
getBarAttribute(barName, {alternative}={}) {
    const attr = alternative || (barName ? this.data[barName].attribute : null);
    if ( !attr || !this.actor ) return null;
    let data = getProperty(this.actor.data.data, attr);

    // Single values
    if ( Number.isFinite(data) ) {
      return {
        type: "value",
        attribute: attr,
        value: data
      }
    }

    // Attribute objects
    else if ( (typeof data === "object") && ("value" in data) && ("max" in data) ) {
      data = duplicate(data);
      return {
        type: "bar",
        attribute: attr,
        value: parseInt(data.value || 0),
        max: parseInt(data.max || 0)
      }
    }

    // Otherwise null
    return null;
  }
*/
    /*
    static getResource(actor) {
        if (actor == undefined || AlwaysHP.app == undefined) return;

        let resource = game.settings.get("always-hp", "resourcename");
        if (resource == 'attributes.hp') {
            return actor.data?.data?.attributes?.hp
        } else {
            let parts = resource.split(".");
            let data = actor.data.data;
            for (let i = 0; i < parts.length; i++) {
                if (data[parts[i]] != undefined)
                    data = data[parts[i]];
            }
            return data;
        }
    }*/

    static getValue(resource) {
        return (resource instanceof Object ? resource.value : resource);
    }

    static changeHP(value, active) {
        //CONFIG.debug.hooks = true;
        return Promise.all(canvas.tokens.controlled.map(t => {
            const a = t.actor; //game.actors.get(t.actor.id);

            let resourcename = (game.settings.get("always-hp", "resourcename") || "attributes.hp");
            let resource = getProperty(a.data, "data." + resourcename); //AlwaysHP.getResource(a);
            if (value == 'zero')
                value = AlwaysHP.getValue(resource);
            if (value == 'full')
                value = (resource instanceof Object ? resource.value - resource.max : resource);

            if (active != undefined && game.settings.get("always-hp", "add-defeated")) {
                let status = CONFIG.statusEffects.find(e => e.id === CONFIG.Combat.defeatedStatusId);
                let effect = a && status ? status : CONFIG.controlIcons.defeated;
                const exists = (effect.icon == undefined ? (t.data.overlayEffect == effect) : (a.effects.find(e => e.getFlag("core", "statusId") === effect.id) != undefined));
                if (exists != active)
                    t.toggleEffect(effect, { overlay: true, active: (active == 'toggle' ? !exists : active) });
            }

            if (active === false && game.settings.get("always-hp", "clear-savingthrows")) {
                a.update({ "data.attributes.death.failure": 0, "data.attributes.death.success": 0 });
            }

            log('applying damage', a, value);
            if (value != 0) {
                if (game.system.id == "dnd5e" && game.settings.get("always-hp", "resourcename") == 'attributes.hp') {
                    a.applyDamage(value).then(() => {
                        AlwaysHP.refreshSelected();
                    });
                } else {
                    AlwaysHP.applyDamage(a, value).then(() => {
                        AlwaysHP.refreshSelected();
                    });
                }
            }
        }));
    }

    static async applyDamage(actor, amount = 0, multiplier = 1) {
        let updates = {};
        let resourcename = game.settings.get("always-hp", "resourcename");
        let resource = getProperty(a.data, "data." + resourcename); //AlwaysHP.getResource(actor);
        if (resource instanceof Object) {
            amount = Math.floor(parseInt(amount) * multiplier);

            // Deduct damage from temp HP first
            let dt = 0;
            let tmpMax = 0;
            if (resource.temp != undefined) {
                const tmp = parseInt(resource.temp) || 0;
                dt = amount > 0 ? Math.min(tmp, amount) : 0;
                // Remaining goes to health
                tmpMax = parseInt(hp.tempmax) || 0;

                updates["data." + resourcename + ".temp"] = tmp - dt;
            }

            // Update the Actor
            const dh = Math.clamped(resource.value - (amount - dt), 0, resource.max + tmpMax);
            updates["data." + resourcename + ".value"] = dh;
        } else {
            let value = AlwaysHP.getValue(resource);
            updates["data." + resourcename] = (value - amount);
        }

        return actor.update(updates);
    }

    static refreshSelected() {
        if (AlwaysHP.app == undefined) return;

        if (canvas.tokens.controlled.length == 0)
            AlwaysHP.app.tokenname = "";
        else if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            let resourcename = game.settings.get("always-hp", "resourcename");
            let resource = getProperty(a.data, "data." + resourcename);//AlwaysHP.getResource(canvas.tokens.controlled[0].actor);
            let value = AlwaysHP.getValue(resource);
            
            AlwaysHP.app.tokenname = canvas.tokens.controlled[0].data.name + " " + (value != undefined ? "[" + value + "]" : '');
        }
        else
            AlwaysHP.app.tokenname = "Multiple (" + canvas.tokens.controlled.length + ")";
        if (AlwaysHP.app != undefined)
            AlwaysHP.app.changeToken();
    }

    static addDeathST(save, value) {
        if (canvas.tokens.controlled.length == 1) {
            let prop = canvas.tokens.controlled[0].actor.data.data.attributes.death;
            prop[save ? 'success' : 'failure'] = Math.max(0, Math.min(3, prop[save ? 'success' : 'failure'] + value));

            let updates = {};
            updates["data.attributes.death." + (save ? 'success' : 'failure')] = prop[save ? 'success' : 'failure'];
            canvas.tokens.controlled[0].actor.update(updates);

            if (AlwaysHP.app != undefined)
                AlwaysHP.app.changeToken();
        }
    }
}

export class AlwaysHPApp extends Application {
    tokenname = '';

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
            tokenname: this.tokenname
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

    changeToken() {
        $('#selected-characters', this.element).html(this.tokenname);

        let actor = (canvas.tokens.controlled.length == 1 ? canvas.tokens.controlled[0].actor : null);
        let showST = (actor != undefined && game.system.id == "dnd5e" && actor.data.data.attributes.hp.value == 0 && actor?.hasPlayerOwner);
        $('.death-savingthrow', this.element).css({ display: (showST ? 'inline-block' : 'none') });
        if (showST) {
            $('.death-savingthrow.fail > div').each(function (idx) { $(this).toggleClass('active', idx < actor.data.data.attributes.death.failure) });
            $('.death-savingthrow.save > div').each(function (idx) { $(this).toggleClass('active', idx < actor.data.data.attributes.death.success) });
        }
    }

    get getValue() {
        let value = parseInt($('#alwayshp-hp', this.element).val());
        if (isNaN(value))
            value = 1;
        return value;
    }

    clearInput() {
        if (game.settings.get("always-hp", "clear-after-enter"))
            $('#alwayshp-hp', this.element).val('');
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            if (ev.shiftKey == true)
                AlwaysHP.changeHP(0, 'toggle');
            else {
                log('set character to dead');
                AlwaysHP.changeHP('zero', true);
                this.clearInput();
            }
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to hurt');
            AlwaysHP.changeHP('zero');
            this.clearInput();
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
            let value = this.getValue;
            if (value != '') AlwaysHP.changeHP(Math.abs(value));
            this.clearInput();
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
            let value = this.getValue;
            if (value != '') AlwaysHP.changeHP(-Math.abs(value), false);
            this.clearInput();
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
            AlwaysHP.changeHP('full', false);
            this.clearInput();
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to heal');
            AlwaysHP.changeHP('full');
            this.clearInput();
        });

        if (game.settings.get('always-hp', 'double-click')) {
            html.find('#alwayshp-btn-hurt').dblclick(ev => {
                ev.preventDefault();
                log('set character to hurt');
                AlwaysHP.changeHP('zero');
                this.clearInput();
            });

            html.find('#alwayshp-btn-heal').dblclick(ev => {
                ev.preventDefault();
                log('set character to heal');
                AlwaysHP.changeHP('full');
                this.clearInput();
            });
        }
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
        }).keypress(ev => {
            if (ev.which == 13) {
                let value = this.getValue;
                if (value != '' && value != 0) {
                    ev.preventDefault();

                    let rawvalue = $('#alwayshp-hp', this.element).val();

                    AlwaysHP.changeHP(rawvalue.startsWith('+') ? -Math.abs(value) : Math.abs(value)); //Heal with a + but everything else is a hurt
                    this.clearInput();
                }
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
                        elmnt.style.zIndex = null;
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

        html.find('.death-savingthrow').click(ev => {
            ev.preventDefault();
            log('add death saving throw');
            AlwaysHP.addDeathST($(ev.currentTarget).hasClass('save'), 1);
        }).contextmenu(ev => {
            ev.preventDefault();
            log('remove death saving throw');
            AlwaysHP.addDeathST($(ev.currentTarget).hasClass('save'), -1);
        });
    }
}

Hooks.on('ready', () => {
    AlwaysHP.init();
});

Hooks.on('renderAlwaysHPApp', (app, html, options) => {
    if (game.user.data.flags.alwayshp) {
        let pos = game.user.data.flags.alwayshp.alwayshpPos;
        log('setting position', pos);
        AlwaysHP.app.setPos(pos);
    }
    AlwaysHP.app.show();
});

Hooks.on('controlToken', AlwaysHP.refreshSelected);

Hooks.on('updateActor', (actor, data) => {
    log('Updating actor', actor, data);
    if (canvas.tokens.controlled.length == 1
        && canvas.tokens.controlled[0]?.actor.id == actor.id
        && (getProperty(data, "data.attributes.death") != undefined || getProperty(data, "data." + game.settings.get("always-hp", "resourcename")))) {
        AlwaysHP.refreshSelected();
    }
});
