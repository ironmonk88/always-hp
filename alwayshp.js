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
export let setting = key => {
    return game.settings.get("always-hp", key);
};

export let isV10 = () => {
    return isNewerVersion(game.version, "9.9999");
};

export class AlwaysHP extends Application {
    tokenname = '';
    tokenstat = '';
    tokentemp = '';
    tokentooltip = '';
    color = "";
    valuePct = null;
    tempPct = null;

    static get defaultOptions() {
        let pos = game.user.getFlag("always-hp", "alwayshpPos");
        return mergeObject(super.defaultOptions, {
            id: "always-hp",
            template: "modules/always-hp/templates/alwayshp.html",
            classes: ["always-hp"],
            popOut: true,
            resizable: false,
            top: pos?.top || 60,
            left: pos?.left || (($('#board').width / 2) - 150),
            width: 300,
        });
    }

    async _render(force, options) {
        let that = this;
        return super._render(force, options).then((html) => {
            $('h4', this.element)
                .addClass('flexrow')
                .append($('<div>').addClass('character-name').html(this.tokenname))
                .append($('<div>').addClass('token-stats flexrow').attr('title', this.tokentooltip).html((this.tokentemp ? `<div class="stat temp">${this.tokentemp}</div>` : '') + (this.tokenstat ? `<div class="stat" style="background-color:${this.color}">${this.tokenstat}</div>` : '')));
            delete ui.windows[that.appId];
            this.refreshSelected();
            $('#alwayshp-hp').focus();
        });
    }

    async close(options) {
        if (options?.properClose) {
            super.close(options);
            game.AlwaysHP.app = null;
        }
    }

    getData() {
        return {
            tokenname: this.tokenname
        };
    }

    getResourceValue(resource) {
        return (resource instanceof Object ? resource.value : resource);
    }

    getResourceMax(resource) {
        return (resource instanceof Object ? resource.max : null);
    }

    getResValue(resource, property = "value", defvalue = null) {
        return (resource instanceof Object ? resource[property] : defvalue) ?? 0;
    }

    async changeHP(value, active) {
        for (let t of canvas.tokens.controlled) {
            const a = t.actor;

            if (!a)
                continue;

            let tValue = duplicate(value);

            let dataname = (isV10() ? "system." : "data.");
            let resourcename = (setting("resourcename") || (game.system?.primaryTokenAttribute ?? game.data?.primaryTokenAttribute) || 'attributes.hp');
            let resource = getProperty(isV10() ? a : a.data, dataname + resourcename);

            if (tValue.value == 'zero')
                tValue.value = this.getResValue(resource, "value", resource) + this.getResValue(resource, "temp");
            if (value.value == 'full')
                tValue.value = (resource instanceof Object ? resource.value - resource.max : resource);

            let defeatedStatus = (isV10() ? CONFIG.specialStatusEffects.DEFEATED : CONFIG.Combat.defeatedStatusId);

            if (active != undefined && setting("add-defeated")) {
                let status = CONFIG.statusEffects.find(e => e.id === defeatedStatus);
                let effect = game.system.id == "pf2e" ? game.settings.get("pf2e", "deathIcon") : a && status ? status : CONFIG.controlIcons.defeated;
                let overlay = (isV10() ? t.document.overlayEffect : t.data.overlayEffect);
                const exists = (effect.icon == undefined ? (overlay == effect) : (a.effects.find(e => e.getFlag("core", "statusId") === effect.id) != undefined));

                if (exists != active)
                    await t.toggleEffect(effect, { overlay: true, active: (active == 'toggle' ? !exists : active) });
            }

            if (active === false && setting("clear-savingthrows")) {
                a.update(isV10()
                    ? { "system.attributes.death.failure": 0, "system.attributes.death.success": 0 }
                    : { "data.attributes.death.failure": 0, "data.attributes.death.success": 0 });
            }

            log('applying damage', a, tValue);
            if (tValue.value != 0) {
                //if (game.system.id == "dnd5e" && setting("resourcename") == 'attributes.hp') {
                //    await a.applyDamage(value);
                //} else {
                await this.applyDamage(t, tValue);
                //}
            }
        };

        this.refreshSelected();
    }

    async applyDamage(token, amount, multiplier = 1) {
        let actor = token.actor;
        let { value, target } = amount;
        let updates = {};
        let dataname = (isV10() ? "system." : "data.");
        let resourcename = (setting("resourcename") || (game.system?.primaryTokenAttribute ?? game.data?.primaryTokenAttribute) || 'attributes.hp');
        let resource = getProperty((isV10() ? actor : actor.data), dataname + resourcename);
        if (resource instanceof Object) {
            value = Math.floor(parseInt(value) * multiplier);

            // Deduct damage from temp HP first
            if (resource.hasOwnProperty("tempmax") && target == "max") {
                const dm = (resource.tempmax ?? 0) - value;
                updates[dataname + resourcename + ".tempmax"] = dm;
            } else {
                let dt = 0;
                let tmpMax = 0;
                if (resource.hasOwnProperty("temp")) {
                    const tmp = parseInt(resource.temp) || 0;
                    dt = (value > 0 || target == 'temp') && target != 'regular' && target != 'max' ? Math.min(tmp, value) : 0;
                    // Remaining goes to health

                    tmpMax = parseInt(resource.tempmax) || 0;

                    updates[dataname + resourcename + ".temp"] = tmp - dt;
                }

                // Update the Actor
                if (target != 'temp' && target != 'max' && dt >= 0) {
                    let change = (value - dt);
                    const dh = Math.clamped(resource.value - change, (game.system.id == 'D35E' || game.system.id == 'pf1' ? -2000 : 0), resource.max + tmpMax);
                    updates[dataname + resourcename + ".value"] = dh;

                    if (isV10()) {
                        let display = change + dt;
                        canvas.interface.createScrollingText(token.center, (-display).signedString(), {
                            anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                            direction: display > 0 ? CONST.TEXT_ANCHOR_POINTS.BOTTOM : CONST.TEXT_ANCHOR_POINTS.TOP,
                            distance: token.h,
                            fontSize: 28,
                            stroke: 0x000000,
                            strokeThickness: 4,
                            jitter: 0.25
                        });
                    } else {
                        token.hud.createScrollingText((-change).signedString(), {
                            anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
                            fontSize: 32,
                            fill: (change > 0 ? 16711680 : 65280),
                            stroke: 0x000000,
                            strokeThickness: 4,
                            jitter: 0.25
                        });
                    }
                }
            }
        } else {
            let val = Math.floor(parseInt(resource));
            updates[dataname + resourcename] = (val - value);
        }

        return await actor.update(updates);
    }

    sendMessage(dh, dt) {
        const speaker = ChatMessage.getSpeaker({ user: game.user.id });

        let messageData = {
            user: game.user.id,
            speaker: speaker,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
            content: `${actor.name} has changed HP by: ${dt + dh}` + (dt != 0 ? `<small><br/>Temporary: ${dt}<br/>HP: ${dh}</small>` : '')
        };

        ChatMessage.create(messageData);
    }

    refreshSelected() {
        this.valuePct = null;
        this.tokenstat = "";
        this.tokentemp = "";
        this.tokentooltip = "";
        let dataname = (isV10() ? "system." : "data.");
        $('.character-name', this.element).removeClass("single");
        if (canvas.tokens.controlled.length == 0)
            this.tokenname = "";
        else if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                this.tokenname = "";
            else {
                $('.character-name', this.element).addClass("single");
                let resourcename = setting("resourcename");
                let resource = getProperty((isV10() ? a : a.data), dataname + resourcename);

                let value = this.getResValue(resource, "value", resource);
                let max = this.getResValue(resource, "max");
                let temp = this.getResValue(resource, "temp");
                let tempmax = this.getResValue(resource, "tempmax");

                // Differentiate between effective maximum and displayed maximum
                const effectiveMax = Math.max(0, max + tempmax);
                let displayMax = max + (tempmax > 0 ? tempmax : 0);

                // Allocate percentages of the total
                const tempPct = Math.clamped(temp, 0, displayMax) / displayMax;
                const valuePct = Math.clamped(value, 0, effectiveMax) / displayMax;

                this.valuePct = valuePct;
                this.tempPct = tempPct;
                const color = [(1 - (this.valuePct / 2)), this.valuePct, 0];
                this.color = `rgba(${parseInt(color[0] * 255)},${parseInt(color[1] * 255)},${parseInt(color[2] * 255)}, 0.7)`;

                this.tokenname = canvas.tokens.controlled[0]?.name ?? canvas.tokens.controlled[0]?.data?.name;
                this.tokenstat = value;
                this.tokentemp = temp;
                this.tokentooltip = `HP: ${value}, Temp: ${temp}, Max: ${max}`;
            }
        }
        else {
            this.tokenname = `${i18n("ALWAYSHP.Multiple")} <span class="count">${canvas.tokens.controlled.length}</span>`;
        }

        this.changeToken();
    }

    addDeathST(save, value) {
        if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                return;

            let prop = (isV10() ? a.system.attributes.death : a.data.data.attributes.death);
            prop[save ? 'success' : 'failure'] = Math.max(0, Math.min(3, prop[save ? 'success' : 'failure'] + value));

            let dataname = (isV10() ? "system." : "data.");
            let updates = {};
            updates[dataname + "attributes.death." + (save ? 'success' : 'failure')] = prop[save ? 'success' : 'failure'];
            canvas.tokens.controlled[0].actor.update(updates);

            this.changeToken();
        }
    }

    changeToken() {
        $('.character-name', this.element).html(this.tokenname);
        $('.token-stats', this.element).attr('title', this.tokentooltip).html((this.tokentemp ? `<div class="stat temp">${this.tokentemp}</div>` : '') + (this.tokenstat ? `<div class="stat" style="background-color:${this.color}">${this.tokenstat}</div>` : ''));

        let actor = (canvas.tokens.controlled.length == 1 ? canvas.tokens.controlled[0].actor : null);
        let data = (isV10() ? actor?.system : actor?.data?.data);
        let showST = (actor != undefined && game.system.id == "dnd5e" && data?.attributes.hp.value == 0 && actor?.hasPlayerOwner);
        $('.death-savingthrow', this.element).css({ display: (showST ? 'inline-block' : 'none') });
        if (showST && data.attributes.death) {
            $('.death-savingthrow.fail > div', this.element).each(function (idx) { $(this).toggleClass('active', idx < data.attributes.death.failure) });
            $('.death-savingthrow.save > div', this.element).each(function (idx) { $(this).toggleClass('active', idx < data.attributes.death.success) });
        }

        $('.resource', this.element).toggle(canvas.tokens.controlled.length == 1 && this.valuePct != undefined);
        if (this.valuePct != undefined) {
            $('.resource .bar', this.element).css({ width: (this.valuePct * 100) + '%', backgroundColor: this.color });
            $('.resource .temp-bar', this.element).toggle(this.tempPct > 0).css({ width: (this.tempPct * 100) + '%' });
        }
    }

    get getValue() {
        let value = $('#alwayshp-hp', this.element).val();
        let result = { value: value };
        if (value.indexOf("r") > -1 || value.indexOf("R") > -1) {
            result.target = "regular";
            result.value = result.value.replace('r', '').replace('R', '');
        }
        if (value.indexOf("t") > -1 || value.indexOf("T") > -1) {
            result.target = "temp";
            result.value = result.value.replace('t', '').replace('T', '');
        }
        if (value.indexOf("m") > -1 || value.indexOf("M") > -1) {
            result.target = "max";
            result.value = result.value.replace('m', '').replace('M', '');
        }

        result.value = parseInt(result.value);
        if (isNaN(result.value))
            result.value = 1;
        return result;
    }

    clearInput() {
        if (setting("clear-after-enter"))
            $('#alwayshp-hp', this.element).val('');
    }

    getChangeValue(perc) {
        let change = "";
        if (canvas.tokens.controlled.length == 1) {
            const actor = canvas.tokens.controlled[0].actor;

            let dataname = (isV10() ? "system." : "data.");
            let resourcename = (setting("resourcename") || (game.system.primaryTokenAttribute ?? game.system.data.primaryTokenAttribute) || 'attributes.hp');
            let resource = getProperty(actor, dataname + resourcename);

            if (resource.hasOwnProperty("max")) {
                let max = this.getResValue(resource, "max");
                let tempmax = this.getResValue(resource, "tempmax");
                const effectiveMax = Math.max(0, max + tempmax);
                let val = Math.floor(parseInt(effectiveMax * perc));
                if (val >= 0)
                    val++;
                change = val - Math.floor(parseInt(resource.value));
            }
        }

        return change;
    }

    activateListeners(html) {
        super.activateListeners(html);

        let that = this;
        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            if (ev.shiftKey == true)
                this.changeHP({ value: 0 }, 'toggle');
            else {
                log('set character to dead');
                this.changeHP({ value: 'zero' }, true);
                this.clearInput();
            }
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to hurt');
            this.changeHP({ value: 'zero' });
            this.clearInput();
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
            let value = this.getValue;
            if (value.value != '') {
                value.value = Math.abs(value.value);
                this.changeHP(value);
            }
            this.clearInput();
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
            let value = this.getValue;
            if (value.value != '') {
                value.value = -Math.abs(value.value);
                this.changeHP(value, false);
            }
            this.clearInput();
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
            this.changeHP({ value: 'full' }, false);
            this.clearInput();
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to heal');
            this.changeHP({ value: 'full' });
            this.clearInput();
        });

        if (setting('double-click')) {
            html.find('#alwayshp-btn-hurt').dblclick(ev => {
                ev.preventDefault();
                log('set character to hurt');
                this.changeHP({ value: 'zero' });
                this.clearInput();
            });

            html.find('#alwayshp-btn-heal').dblclick(ev => {
                ev.preventDefault();
                log('set character to heal');
                this.changeHP({ value: 'full' });
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
                if (value.value != '' && value.value != 0) {
                    ev.preventDefault();

                    let rawvalue = $('#alwayshp-hp', this.element).val();

                    value.value = (rawvalue.startsWith('+') || (!rawvalue.startsWith('-') && !setting("no-sign-negative")) ? -Math.abs(value.value) : Math.abs(value.value));

                    this.changeHP(value); //Heal with a + but everything else is a hurt
                    this.clearInput();
                }
            }
        });

        html.find('.death-savingthrow').click(ev => {
            ev.preventDefault();
            log('add death saving throw');
            this.addDeathST($(ev.currentTarget).hasClass('save'), 1);
        }).contextmenu(ev => {
            ev.preventDefault();
            log('remove death saving throw');
            this.addDeathST($(ev.currentTarget).hasClass('save'), -1);
        });

        
        html.find('.resource').mousemove(ev => {
            if (!setting("allow-bar-click"))
                return;
            let perc = ev.offsetX / $(ev.currentTarget).width();
            let change = this.getChangeValue(perc);

            $('.bar-change', html).html(change);
            log("resource change");
        }).click(ev => {
            if (!setting("allow-bar-click"))
                return;
            let perc = ev.offsetX / $(ev.currentTarget).width();
            let change = this.getChangeValue(perc);

            this.changeHP({ value: -change, target: 'regular' });
            $('.bar-change', html).html('');
        });

        html.find('.bar-change').mousemove(ev => {
            ev.preventDefault;
            ev.stopPropagation();
            log("bar change");
        });
    }
}

Hooks.on('init', () => {
    registerSettings();
});

Hooks.on('ready', () => {
    game.AlwaysHP = {
        app: null,
        toggleApp: (show = 'toggle') => {
            if (show == 'toggle') show = !game.AlwaysHP.app;

            if (show && !game.AlwaysHP.app) {
                game.AlwaysHP.app = new AlwaysHP().render(true);
                window.setTimeout(() => { $('#alwayshp-hp').focus(); }, 100);
            } else if (!show && game.AlwaysHP.app)
                game.AlwaysHP.app.close({ properClose: true });
        },
        refresh: () => {
            if (game.AlwaysHP.app)
                game.AlwaysHP.app.refreshSelected();
        }
    };
    if ((setting("show-option") == 'on' || (setting("show-option") == 'toggle' && setting("show-dialog"))) && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM)))
        game.AlwaysHP.toggleApp(true);

    if (setting("show-option") == "combat" && game.combats.active && game.combats.active.started && !game.AlwaysHP)
        game.AlwaysHP.toggleApp(true);

    let oldDragMouseUp = Draggable.prototype._onDragMouseUp;
    Draggable.prototype._onDragMouseUp = function (event) {
        Hooks.call(`dragEnd${this.app.constructor.name}`, this.app);
        return oldDragMouseUp.call(this, event);
    }
});

Hooks.on('controlToken', () => {
    if (setting("show-option") == "token") {
        if (canvas.tokens.controlled.length == 0) // delay a second to make sure we aren't selecting a new token
            window.setTimeout(() => { if (canvas.tokens.controlled.length == 0) game.AlwaysHP.toggleApp(false); }, 100);
        else if (!game.AlwaysHP.app)
            game.AlwaysHP.toggleApp(true);
        else
            game.AlwaysHP.refresh();
    } else
        game.AlwaysHP.refresh();
});

Hooks.on('updateActor', (actor, data) => {
    //log('Updating actor', actor, data);
    let dataname = (isV10() ? "system." : "data.");
    if (canvas.tokens.controlled.length == 1
        && canvas.tokens.controlled[0]?.actor?.id == actor.id
        && (getProperty(data, dataname + "attributes.death") != undefined || getProperty(data, dataname + setting("resourcename")))) {
        game.AlwaysHP.refresh();
    }
});

Hooks.on('updateCombat', (combat, data) => {
    if (setting("show-option") == "combat") {
        game.AlwaysHP.toggleApp(game.combats.active && game.combats.active.started);
    }
});

Hooks.on('deleteCombat', (combat, data) => {
    if (setting("show-option") == "combat") {
        game.AlwaysHP.toggleApp(game.combats.active && game.combats.active.started);
    }
});

Hooks.on('dragEndAlwaysHP', (app) => {
    game.user.setFlag("always-hp", "alwayshpPos", { left: app.position.left, top: app.position.top });
})

Hooks.on("getSceneControlButtons", (controls) => {
    if (setting("show-option") == 'toggle' && (setting("load-option") == 'everyone' || (setting("load-option") == 'gm' == game.user.isGM))) {
        let tokenControls = controls.find(control => control.name === "token")
        tokenControls.tools.push({
            name: "toggledialog",
            title: "ALWAYSHP.toggledialog",
            icon: "fas fa-briefcase-medical",
            toggle: true,
            active: setting('show-dialog'),
            onClick: (toggled) => {
                game.settings.set('always-hp', 'show-dialog', toggled);
                game.AlwaysHP.toggleApp(toggled);
            }
        });
    }
});
