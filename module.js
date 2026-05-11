import { libWrapper } from "./shim.js";

const ROLES = Object.freeze(["none", "player", "trusted", "assistant", "gamemaster"]);

Hooks.once("init", () => {
    libWrapper.register("pf2e-karmic-dice", "CONFIG.Dice.termTypes.DiceTerm.prototype.roll", async function (wrapped, options) {
        const oldRoll = await wrapped(options);
        const newRoll = JSON.parse(JSON.stringify(oldRoll));

        // FIX #4: Defensive CheckRoll detection — works across PF2e versions
        const isCheckRoll = this._root?.constructor?.name === "CheckRoll"
            || (typeof CONFIG?.PF2E?.Roll?.Check !== "undefined" && this._root instanceof CONFIG.PF2E.Roll.Check);

        if (isCheckRoll && game.settings.get("pf2e-karmic-dice", ROLES[game.user.role])) {
            const userKarma = game.user.getFlag("pf2e-karmic-dice", "karma") ?? { history: [], cumulative: 0 };

            userKarma.history.push(oldRoll.result);
            while (userKarma.history.length > game.settings.get("pf2e-karmic-dice", "history.value")) {
                userKarma.history.shift();
            }

            if (this._root.options.heroPoint && game.settings.get("pf2e-karmic-dice", "heroPoint.enabled")) {
                if (oldRoll.result <= game.settings.get("pf2e-karmic-dice", "heroPoint.threshold")) {
                    newRoll.result = Math.clamp(oldRoll.result + game.settings.get("pf2e-karmic-dice", "heroPoint.value"), 1, this.faces);
                }
            } else if (userKarma.history.length === game.settings.get("pf2e-karmic-dice", "history.value")) {
                const average = userKarma.history.reduce((a, b) => a + b, 0) / userKarma.history.length;

                if (game.settings.get("pf2e-karmic-dice", "lowerThreshold.enabled") && average <= game.settings.get("pf2e-karmic-dice", "lowerThreshold.value")) {
                    userKarma.cumulative = (game.settings.get("pf2e-karmic-dice", "nudge.cumulative")) ? userKarma.cumulative + 1 : 1;
                    const nudge = game.settings.get("pf2e-karmic-dice", "nudge.value") * userKarma.cumulative;
                    newRoll.result = Math.clamp(oldRoll.result + nudge, 1, this.faces);
                } else if (game.settings.get("pf2e-karmic-dice", "upperThreshold.enabled") && average >= game.settings.get("pf2e-karmic-dice", "upperThreshold.value")) {
                    userKarma.cumulative = (game.settings.get("pf2e-karmic-dice", "nudge.cumulative")) ? userKarma.cumulative + 1 : 1;
                    const nudge = game.settings.get("pf2e-karmic-dice", "nudge.value") * userKarma.cumulative;
                    newRoll.result = Math.clamp(oldRoll.result - nudge, 1, this.faces);
                } else {
                    userKarma.cumulative = 0;
                }
            }

            if (oldRoll.result !== newRoll.result) {
                userKarma.history[userKarma.history.length - 1] = newRoll.result;
                newRoll.originalResult = oldRoll.result;
                this.options.karma = true;
            } else {
                userKarma.cumulative = 0;
            }

            game.user.setFlag("pf2e-karmic-dice", "karma", userKarma);

            this.results.pop();
            this.results.push(newRoll);
            return newRoll;
        }

        return newRoll;
    });

    game.settings.register("pf2e-karmic-dice", "player", {
        name: "USER.RolePlayer",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice", "trusted", {
        name: "USER.RoleTrusted",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice", "assistant", {
        name: "USER.RoleAssistant",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice", "gamemaster", {
        name: "USER.RoleGamemaster",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice", "history.value", {
        name: "pf2e-karmic-dice.settings.history.value.name",
        hint: "pf2e-karmic-dice.settings.history.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 2, max: 15, step: 1, initial: 5 })
    });

    game.settings.register("pf2e-karmic-dice", "lowerThreshold.enabled", {
        name: "pf2e-karmic-dice.settings.lowerThreshold.enabled.name",
        hint: "pf2e-karmic-dice.settings.lowerThreshold.enabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("pf2e-karmic-dice", "lowerThreshold.value", {
        name: "pf2e-karmic-dice.settings.lowerThreshold.value.name",
        hint: "pf2e-karmic-dice.settings.lowerThreshold.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 20, step: 1, initial: 5 })
    });

    game.settings.register("pf2e-karmic-dice", "upperThreshold.enabled", {
        name: "pf2e-karmic-dice.settings.upperThreshold.enabled.name",
        hint: "pf2e-karmic-dice.settings.upperThreshold.enabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register("pf2e-karmic-dice", "upperThreshold.value", {
        name: "pf2e-karmic-dice.settings.upperThreshold.value.name",
        hint: "pf2e-karmic-dice.settings.upperThreshold.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 20, step: 1, initial: 15 })
    });

    game.settings.register("pf2e-karmic-dice", "nudge.value", {
        name: "pf2e-karmic-dice.settings.nudge.value.name",
        hint: "pf2e-karmic-dice.settings.nudge.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 10, step: 1, initial: 5 })
    });

    game.settings.register("pf2e-karmic-dice", "nudge.cumulative", {
        name: "pf2e-karmic-dice.settings.nudge.cumulative.name",
        hint: "pf2e-karmic-dice.settings.nudge.cumulative.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice", "heroPoint.enabled", {
        name: "pf2e-karmic-dice.settings.heroPoint.enabled.name",
        hint: "pf2e-karmic-dice.settings.heroPoint.enabled.hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register("pf2e-karmic-dice", "heroPoint.value", {
        name: "pf2e-karmic-dice.settings.heroPoint.value.name",
        hint: "pf2e-karmic-dice.settings.heroPoint.value.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 10, step: 1, initial: 10 })
    });

    game.settings.register("pf2e-karmic-dice", "heroPoint.threshold", {
        name: "pf2e-karmic-dice.settings.heroPoint.threshold.name",
        hint: "pf2e-karmic-dice.settings.heroPoint.threshold.hint",
        scope: "world",
        config: true,
        type: new foundry.data.fields.NumberField({ min: 1, max: 20, step: 1, initial: 9 })
    });
});

// FIX #3: renderSettingsConfig — replaced jQuery with native DOM
Hooks.on("renderSettingsConfig", (_, html) => {
    const tab = html.querySelector?.('.tab[data-tab="pf2e-karmic-dice"]')
        ?? html.find?.('.tab[data-tab="pf2e-karmic-dice"]')?.[0]; // fallback for v13

    if (!tab) return;

    function beforeGroup(dataSettingID, key, dom = "h3") {
        const group = tab.querySelector(`.form-group[data-setting-id="${dataSettingID}"]`);
        if (!group) return;
        const header = document.createElement(dom);
        header.textContent = game.i18n.localize(key);
        group.before(header);
    }

    if (game.user.isGM) {
        beforeGroup("pf2e-karmic-dice.player", "pf2e-karmic-dice.headers.roles");
        beforeGroup("pf2e-karmic-dice.history.value", "pf2e-karmic-dice.headers.history");
        beforeGroup("pf2e-karmic-dice.lowerThreshold.enabled", "pf2e-karmic-dice.headers.lowerThreshold");
        beforeGroup("pf2e-karmic-dice.upperThreshold.enabled", "pf2e-karmic-dice.headers.upperThreshold");
        beforeGroup("pf2e-karmic-dice.nudge.value", "pf2e-karmic-dice.headers.nudge");
        beforeGroup("pf2e-karmic-dice.heroPoint.enabled", "pf2e-karmic-dice.headers.heroPoints");
    }
});

// FIX #2: renderChatMessageHTML — renamed hook, plain HTMLElement (no jQuery)
Hooks.on("renderChatMessageHTML", (message, html, data) => {
    if (!game.user.isGM || !message.rolls?.length) return;
    const rolls = message.rolls.filter((roll) => roll.dice.some((dice) => dice.options.karma));
    if (rolls.length === 0) return;

    const messages = [];
    for (const roll of rolls) {
        for (const die of roll.dice) {
            for (const result of die.results) {
                if (Object.hasOwn(result, "originalResult")) {
                    messages.push(game.i18n.format("pf2e-karmic-dice.adjustRoll", {
                        originalResult: result.originalResult,
                        result: result.result
                    }));
                }
            }
        }
    }
    if (messages.length) {
        const a = document.createElement("a");
        a.className = "karma-info";
        a.dataset.tooltip = messages.join("<br>");
        a.dataset.tooltipDirection = "LEFT";
        a.innerHTML = `<i class="fas fa-yin-yang"></i>`;
        html.querySelector(".message-metadata")?.append(a);
    }
});

// FIX #5: pf2e.preReroll — added _flavor param for forward compatibility
Hooks.on("pf2e.preReroll", (oldRoll, unevaluatedNewRoll, heroPoint, keep, _flavor) => {
    if (heroPoint) {
        unevaluatedNewRoll.options.heroPoint = true;
    }
});
