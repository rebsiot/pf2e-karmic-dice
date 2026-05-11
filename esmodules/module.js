import { libWrapper } from "./shim.js";

const ROLES = Object.freeze(["none", "player", "trusted", "assistant", "gamemaster"]);

Hooks.once("init", () => {
    libWrapper.register("pf2e-karmic-dice-draft", "CONFIG.Dice.termTypes.DiceTerm.prototype.roll", async function (wrapped, options) {
        const oldRoll = await wrapped(options);
        const newRoll = JSON.parse(JSON.stringify(oldRoll));

        if (this._root?.constructor.name === "CheckRoll" && game.settings.get("pf2e-karmic-dice-draft", ROLES[game.user.role])) {
            const userKarma = game.user.getFlag("pf2e-karmic-dice-draft", "karma") ?? { history: [], cumulative: 0 };

            userKarma.history.push(oldRoll.result);
            while (userKarma.history.length > game.settings.get("pf2e-karmic-dice-draft", "history.value")) {
                userKarma.history.shift();
            }

            if (this._root.options.heroPoint && game.settings.get("pf2e-karmic-dice-draft", "heroPoint.enabled")) {
                if (oldRoll.result <= game.settings.get("pf2e-karmic-dice-draft", "heroPoint.threshold")) {
                    newRoll.result = Math.clamp(oldRoll.result + game.settings.get("pf2e-karmic-dice-draft", "heroPoint.value"), 1, this.faces);
                }
            } else if (userKarma.history.length === game.settings.get("pf2e-karmic-dice-draft", "history.value")) {
                const average = userKarma.history.reduce((a, b) => a + b, 0) / userKarma.history.length;

                if (game.settings.get("pf2e-karmic-dice-draft", "lowerThreshold.enabled") && average <= game.settings.get("pf2e-karmic-dice", "lowerThreshold.value")) {
                    userKarma.cumulative = ((game.settings.get("pf2e-karmic-dice-draft", "nudge.cumulative")) ? userKarma.cumulative + 1 : 1);
                    const nudge = game.settings.get("pf2e-karmic-dice-draft", "nudge.value") * userKarma.cumulative;
                    newRoll.result = Math.clamp(oldRoll.result + nudge, 1, this.faces);
                }

                if (game.settings.get("pf2e-karmic-dice-draft", "upperThreshold.enabled") && average >= game.settings.get("pf2e-karmic-dice-draft", "upperThreshold.value")) {
                    userKarma.cumulative = ((game.settings.get("pf2e-karmic-dice-draft", "nudge.cumulative")) ? userKarma.cumulative + 1 : 1);
                    const nudge = game.settings.get("pf2e-karmic-dice-draft", "nudge.value") * userKarma.cumulative;
                    newRoll.result = Math.clamp(oldRoll.result - nudge, 1, this.faces);
                }
            }

            if (oldRoll.result != newRoll.result) {
                userKarma.history[userKarma.history.length - 1] = newRoll.result;
                newRoll.originalResult = oldRoll.result;
                this.options.karma = true;
            } else {
                userKarma.cumulative = 0;
            }

            game.user.setFlag("pf2e-karmic-dice-draft", "karma", userKarma);
        }

        this.results.pop();
        this.results.push(newRoll);
        return newRoll;
    });

    game.settings.register("pf2e-karmic-dice-draft", "player", {
        name: "USER.RolePlayer",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice-draft", "trusted", {
        name: "USER.RoleTrusted",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice-draft", "assistant", {
        name: "USER.RoleAssistant",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice-draft", "gamemaster", {
        name: "USER.RoleGamemaster",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice-draft", "history.value", {
        name: "pf2e-karmic-dice-draft.settings.history.value.name",
        hint: "pf2e-karmic-dice-draft.settings.history.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 2, max: 15, step: 1, initial: 5 })
    });

    game.settings.register("pf2e-karmic-dice-draft", "lowerThreshold.enabled", {
        name: "pf2e-karmic-dice-draft.settings.lowerThreshold.enabled.name",
        hint: "pf2e-karmic-dice-draft.settings.lowerThreshold.enabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("pf2e-karmic-dice-draft", "lowerThreshold.value", {
        name: "pf2e-karmic-dice-draft.settings.lowerThreshold.value.name",
        hint: "pf2e-karmic-dice-draft.settings.lowerThreshold.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 20, step: 1, initial: 5 })
    });

    game.settings.register("pf2e-karmic-dice-draft", "upperThreshold.enabled", {
        name: "pf2e-karmic-dice-draft.settings.upperThreshold.enabled.name",
        hint: "pf2e-karmic-dice-draft.settings.upperThreshold.enabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("pf2e-karmic-dice-draft", "upperThreshold.value", {
        name: "pf2e-karmic-dice-draft.settings.upperThreshold.value.name",
        hint: "pf2e-karmic-dice-draft.settings.upperThreshold.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 20, step: 1, initial: 15 })
    });

    game.settings.register("pf2e-karmic-dice-draft", "nudge.value", {
        name: "pf2e-karmic-dice-draft.settings.nudge.value.name",
        hint: "pf2e-karmic-dice-draft.settings.nudge.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 10, step: 1, initial: 5 })
    });

    game.settings.register("pf2e-karmic-dice-draft", "nudge.cumulative", {
        name: "pf2e-karmic-dice-draft.settings.nudge.cumulative.name",
        hint: "pf2e-karmic-dice-draft.settings.nudge.cumulative.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice-draft", "heroPoint.enabled", {
        name: "pf2e-karmic-dice-draft.settings.heroPoint.enabled.name",
        hint: "pf2e-karmic-dice-draft.settings.heroPoint.enabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice-draft", "heroPoint.value", {
        name: "pf2e-karmic-dice-draft.settings.heroPoint.value.name",
        hint: "pf2e-karmic-dice-draft.settings.heroPoint.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 10, step: 1, initial: 10 })
    });

    game.settings.register("pf2e-karmic-dice-draft", "heroPoint.threshold", {
        name: "pf2e-karmic-dice-draft.settings.heroPoint.threshold.name",
        hint: "pf2e-karmic-dice-draft.settings.heroPoint.threshold.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 20, step: 1, initial: 9 })
    });

});

Hooks.on("renderSettingsConfig", (_, html) => {
    const tab = html.find('.tab[data-tab="pf2e-karmic-dice-draft"]');

    function beforeGroup(dataSettingID, key, dom = "h3") {
        tab.find(`.form-group[data-setting-id="${dataSettingID}"]`)
            .before(`<${dom}>${game.i18n.localize(key)}</${dom}>`);
    }

    if (game.user.isGM) {
        beforeGroup("pf2e-karmic-dice-draft.player", "pf2e-karmic-dice.headers.roles");
        beforeGroup("pf2e-karmic-dice-draft.history.value", "pf2e-karmic-dice.headers.history");
        beforeGroup("pf2e-karmic-dice-draft.lowerThreshold.enabled", "pf2e-karmic-dice.headers.lowerThreshold");
        beforeGroup("pf2e-karmic-dice-draft.upperThreshold.enabled", "pf2e-karmic-dice.headers.upperThreshold");
        beforeGroup("pf2e-karmic-dice-draft.nudge.value", "pf2e-karmic-dice.headers.nudge");
        beforeGroup("pf2e-karmic-dice-draft.heroPoint.enabled", "pf2e-karmic-dice.headers.heroPoints");
    }
});

Hooks.on("renderChatMessage", (message, html, data) => {
    if (!game.user.isGM || !message.rolls?.length) return;
    const rolls = message.rolls.filter((roll) => roll.dice.some((dice => dice.options.karma)));

    if (rolls.length !== 0) {
        const message = [];

        for (const roll of rolls) {
            for (const die of roll.dice) {
                for (const result of die.results) {
                    if (Object.hasOwn(result, "originalResult")) {
                        message.push(game.i18n.format("pf2e-karmic-dice-draft.adjustRoll", { originalResult: result.originalResult, result: result.result }));
                    }
                }
            }
        }

        html.find(".message-metadata").append(`<span data-tooltip="${message.join("<br>")}" data-tooltip-direction="LEFT"><i class="fas fa-yin-yang"></i></span>`);
    }
});

Hooks.on("pf2e.preReroll", (oldRoll, unevaluatedNewRoll, heroPoint, keep) => {
    if (heroPoint) {
        unevaluatedNewRoll.options.heroPoint = true;
    }
});
