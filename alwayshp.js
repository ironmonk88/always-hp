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

export class AlwaysHP extends Application {
    tokenname = '';

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
        super._render(force, options).then((html) => {
            $('h4', this.element).append($('<span>').attr('id', 'selected-characters').html(this.tokenname));
        });
    }

    async close(options) {
        super.close(options);
        game.AlwaysHP = null;
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

    async changeHP(value, active) {
        //CONFIG.debug.hooks = true;
        for (let t of canvas.tokens.controlled) {
            const a = t.actor; //game.actors.get(t.actor.id);

            if (!a)
                continue;

            let resourcename = (setting("resourcename") || game.system.data.primaryTokenAttribute || 'attributes.hp');
            let resource = getProperty(a.data, "data." + resourcename); //AlwaysHP.getResource(a);
            let val = value;
            if (value == 'zero')
                val = this.getResourceValue(resource);
            if (value == 'full')
                val = (resource instanceof Object ? resource.value - resource.max : resource);

            if (active != undefined && setting("add-defeated")) {
                let status = CONFIG.statusEffects.find(e => e.id === CONFIG.Combat.defeatedStatusId);
                let effect = a && status ? status : CONFIG.controlIcons.defeated;
                const exists = (effect.icon == undefined ? (t.data.overlayEffect == effect) : (a.effects.find(e => e.getFlag("core", "statusId") === effect.id) != undefined));
                if (exists != active)
                    await t.toggleEffect(effect, { overlay: true, active: (active == 'toggle' ? !exists : active) });
            }

            if (active === false && setting("clear-savingthrows")) {
                a.update({ "data.attributes.death.failure": 0, "data.attributes.death.success": 0 });
            }

            log('applying damage', a, val);
            if (val != 0) {
                if (game.system.id == "dnd5e" && setting("resourcename") == 'attributes.hp') {
                    await a.applyDamage(val);
                } else {
                    await this.applyDamage(a, val);
                }
            }
        };

        this.refreshSelected();
    }

    async applyDamage(actor, amount = 0, multiplier = 1) {
        let updates = {};
        let resourcename = (setting("resourcename") || game.system.data.primaryTokenAttribute || 'attributes.hp');
        let resource = getProperty(actor.data, "data." + resourcename); //AlwaysHP.getResource(actor);
        if (resource instanceof Object) {
            amount = Math.floor(parseInt(amount) * multiplier);

            // Deduct damage from temp HP first
            let dt = 0;
            let tmpMax = 0;
            if (resource.temp != undefined) {
                const tmp = parseInt(resource.temp) || 0;
                dt = amount > 0 ? Math.min(tmp, amount) : 0;
                // Remaining goes to health

                tmpMax = parseInt(resource.tempmax) || 0;

                updates["data." + resourcename + ".temp"] = tmp - dt;
            }

            // Update the Actor
            const dh = Math.clamped(resource.value - (amount - dt), (game.system.id == 'D35E' || game.system.id == 'pf1' ? -2000 : 0), resource.max + tmpMax);
            updates["data." + resourcename + ".value"] = dh;
        } else {
            let value = Math.floor(parseInt(resource));
            updates["data." + resourcename] = (value - amount);
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
            content: `${actor.name} has changed HP by: ${dt + dh}` + (dt != 0 ? `<small><br/>Temporary:${dt}<br/>HP:${dh}</small>` : '')
        };

        ChatMessage.create(messageData);
    }

    refreshSelected() {
        if (canvas.tokens.controlled.length == 0)
            this.tokenname = "";
        else if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                this.tokenname = "";
            else {
                let resourcename = setting("resourcename");
                let resource = getProperty(a.data, "data." + resourcename);//AlwaysHP.getResource(canvas.tokens.controlled[0].actor);
                let value = this.getResourceValue(resource);
                let max = this.getResourceMax(resource);

                this.tokenname = canvas.tokens.controlled[0].data.name + " " + (value != undefined ? "<span>[" + value + (max ? "/" + max : '') + "]</span>" : '');
            }
        }
        else
            this.tokenname = "Multiple (" + canvas.tokens.controlled.length + ")";

        this.changeToken();
    }

    addDeathST(save, value) {
        if (canvas.tokens.controlled.length == 1) {
            let a = canvas.tokens.controlled[0].actor;
            if (!a)
                return;

            let prop = a.data.data.attributes.death;
            prop[save ? 'success' : 'failure'] = Math.max(0, Math.min(3, prop[save ? 'success' : 'failure'] + value));

            let updates = {};
            updates["data.attributes.death." + (save ? 'success' : 'failure')] = prop[save ? 'success' : 'failure'];
            canvas.tokens.controlled[0].actor.update(updates);

            this.changeToken();
        }
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
        if (setting("clear-after-enter"))
            $('#alwayshp-hp', this.element).val('');
    }

    activateListeners(html) {
        super.activateListeners(html);

        let that = this;
        html.find('#alwayshp-btn-dead').click(ev => {
            ev.preventDefault();
            if (ev.shiftKey == true)
                this.changeHP(0, 'toggle');
            else {
                log('set character to dead');
                this.changeHP('zero', true);
                this.clearInput();
            }
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to hurt');
            this.changeHP('zero');
            this.clearInput();
        });
        html.find('#alwayshp-btn-hurt').click(ev => {
            ev.preventDefault();
            log('set character to hurt');
            let value = this.getValue;
            if (value != '') this.changeHP(Math.abs(value));
            this.clearInput();
        });
        html.find('#alwayshp-btn-heal').click(ev => {
            ev.preventDefault();
            log('set character to heal');
            let value = this.getValue;
            if (value != '') this.changeHP(-Math.abs(value), false);
            this.clearInput();
        });
        html.find('#alwayshp-btn-fullheal').click(ev => {
            ev.preventDefault();
            log('set character to fullheal');
            this.changeHP('full', false);
            this.clearInput();
        }).contextmenu(ev => {
            ev.preventDefault();
            log('set character to heal');
            this.changeHP('full');
            this.clearInput();
        });

        if (setting('double-click')) {
            html.find('#alwayshp-btn-hurt').dblclick(ev => {
                ev.preventDefault();
                log('set character to hurt');
                this.changeHP('zero');
                this.clearInput();
            });

            html.find('#alwayshp-btn-heal').dblclick(ev => {
                ev.preventDefault();
                log('set character to heal');
                this.changeHP('full');
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

                    this.changeHP(rawvalue.startsWith('+') ? -Math.abs(value) : Math.abs(value)); //Heal with a + but everything else is a hurt
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
    }
}

Hooks.on('init', () => {
    registerSettings();
});

Hooks.on('ready', () => {
    if (setting("show-dialog"))
        game.AlwaysHP = new AlwaysHP().render(true);

    let oldDragMouseUp = Draggable.prototype._onDragMouseUp;
    Draggable.prototype._onDragMouseUp = function (event) {
        Hooks.call(`dragEnd${this.app.constructor.name}`, this.app);
        return oldDragMouseUp.call(this, event);
    }
});

Hooks.on('controlToken', () => {
    game.AlwaysHP?.refreshSelected();
});

Hooks.on('updateActor', (actor, data) => {
    //log('Updating actor', actor, data);
    if (canvas.tokens.controlled.length == 1
        && canvas.tokens.controlled[0]?.actor.id == actor.id
        && (getProperty(data, "data.attributes.death") != undefined || getProperty(data, "data." + setting("resourcename")))) {
        game.AlwaysHP?.refreshSelected();
    }
});

Hooks.on('dragEndAlwaysHPApp', (app) => {
    game.user.setFlag("always-hp", "alwayshpPos", { left: app.position.left, top: app.position.top });
})

Hooks.on("getSceneControlButtons", (controls) => {
    let tokenControls = controls.find(control => control.name === "token")
    tokenControls.tools.push({
        name: "toggledialog",
        title: "ALWAYSHP.toggledialog",
        icon: "fas fa-briefcase-medical",
        toggle: true,
        active: setting('show-dialog'),
        onClick: toggled => {
            game.settings.set('always-hp', 'show-dialog', toggled);
            if (toggled) {
                if (!game.AlwaysHP)
                    game.AlwaysHP = new AlwaysHP().render(true);
            } else {
                if (game.AlwaysHP)
                    game.AlwaysHP.close();
            }
        }
    });
});
