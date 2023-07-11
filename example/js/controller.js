// Copyright 2022 Samuel Baird
import { sequence, dom, AppNode } from '../../lib/litre/litre.js';

let settings = {};

// reload the current settings from browser storage
const savedSettings = JSON.parse(window.localStorage.getItem('dice_roller_settings'));
if (savedSettings != null) {
	settings = savedSettings;
}

if (!settings.rolls) {
	settings.rolls = [];
}
if (!settings.history) {
	settings.history = [];
}
if (settings.rolls.length == 0) {
	// some default data
	addRoll('Attack: D20 + 5');
	addRoll('Defend: 2D6 + 2');
	addRoll('Save (bane): D20 - D4');
}

function saveSettings () {
	window.localStorage.setItem('dice_roller_settings', JSON.stringify(settings));
}

function getSettings () {
	return settings;
}

function parseRoll (roll) {
	if (roll == null) {
		throw 'roll description must not be blank';
	}
	roll = roll.trim();
	if (roll == '') {
		throw 'roll description must not be blank';
	}

	const eat = (match, spitItOut = false) => {
		const result = roll.match(match);
		if (result) {
			if (!spitItOut) {
				roll = roll.substring(result[0].length);
				roll = roll.trim();
			}
			return result[0];
		} else {
			return false;
		}
	};

	// first eat the name
	const name = eat(/^[A-Z0-9 \(\)]+/i);
	if (!name) {
		throw 'roll must begin with a name, eg. Attack:';
	}
	const colon = eat(/^[:]/);
	if (!colon) {
		throw 'roll name must end with a colon, eg. Attack:';
	}

	let description = '';
	const dice = [];
	const modifiers = [];

	let nextIsPositive = true;
	while (roll.length > 0) {
		if (eat(/^[0-9]*d[0-9]+/i, true)) {
			const number = parseInt(eat(/^[0-9]*/) || '1');
			const d = eat(/^d/i);
			const diceType = parseInt(eat(/^[0-9]+/));
			for (let i = 0; i < number; i++) {
				dice.push(diceType * (nextIsPositive ? 1 : -1));
			}
			description = description + (nextIsPositive ? '' : '-') + number + 'D' + diceType + ' ';
			nextIsPositive = true;
		} else if (eat(/^[0-9]+/i, true)) {
			const number = parseInt(eat(/^[0-9]+/i));
			description = description + (nextIsPositive ? '+' : '-') + number + ' ';
			modifiers.push(number * (nextIsPositive ? 1 : -1));
			nextIsPositive = true;
		} else if (eat(/^\-/)) {
			nextIsPositive = false;
		} else if (eat(/^\+/)) {
			nextIsPositive = true;
		} else {
			throw 'unknown dice or modifier ' + roll;
		}
	}

	if (dice.length == 0 && modifiers.length == 0) {
		throw 'you must include at least one dice or modifier, eg. D6';
	}

	return {
		name: name,
		description: description,
		dice: dice,
		modifiers: modifiers,
	};
}

function addRoll (roll) {
	settings.rolls.push(roll);
	saveSettings();
}

function removeRoll (roll) {
	const i = settings.rolls.indexOf(roll);
	if (i >= 0) {
		settings.rolls.splice(i, 1);
		saveSettings();
	}
}

function addToHistory (name, total) {

}

export { saveSettings, getSettings, parseRoll, addRoll, removeRoll, addToHistory };
