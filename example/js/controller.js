// Copyright 2022 Samuel Baird
import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';

let assets_are_loaded = false;
let settings = {};

// reload the current settings from browser storage
const saved_settings = JSON.parse(window.localStorage.getItem('dice_roller_settings'));
if (saved_settings != null) {
	settings = saved_settings;
}

if (!settings.rolls) {
	settings.rolls = [];
}

function set_assets_are_loaded () {
	assets_are_loaded = true;
}

function app_state () {
	if (!assets_are_loaded) {
		return state.atom('loading_state');
	} else {
		return state.atom('app_state', { settings: settings });
	}
}

function save_settings () {
	window.localStorage.setItem('dice_roller_settings', JSON.stringify(settings));
}

function parse_roll (roll) {
	if (roll == null) {
		throw 'roll description must not be blank';
	}
	roll = roll.trim();
	if (roll == '') {
		throw 'roll description must not be blank';
	}

	const eat = (match, spit_it_out = false) => {
		const result = roll.match(match);
		if (result) {
			if (!spit_it_out) {
				roll = roll.substring(result[0].length);
				roll = roll.trim();
			}
			return result[0];
		} else {
			return false;
		}
	};

	// first eat the name
	const name = eat(/^[A-Z]+/i);
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

	let next_is_positive = true;
	while (roll.length > 0) {
		if (eat(/^[0-9]*d[0-9]+/i, true)) {
			const number = parseInt(eat(/^[0-9]*/) || '1');
			const d = eat(/^d/i);
			const dice_type = parseInt(eat(/^[0-9]+/));
			for (let i = 0; i < number; i++) {
				dice.push(dice_type * (next_is_positive ? 1 : -1));
			}
			description = description + (next_is_positive ? '' : '-') + number + 'D' + dice_type + ' ';
			next_is_positive = true;
		} else if (eat(/^[0-9]+/i, true)) {
			const number = parseInt(eat(/^[0-9]+/i))
			description = description + (next_is_positive ? '+' : '-') + number + ' ';
			modifiers.push(number * (next_is_positive ? 1 : -1));
			next_is_positive = true;
		} else if (eat(/^\-/)) {
			next_is_positive = false;
		} else if (eat(/^\+/)) {
			next_is_positive = true;
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

function add_roll (roll) {
	settings.rolls.push(roll);
	save_settings();
}

function remove_roll (roll) {
	const i = settings.rolls.indexOf(roll);
	if (i >= 0) {
		settings.rolls.splice(i, 1);
		save_settings();
	}
}

export { app_state, set_assets_are_loaded, save_settings, parse_roll, add_roll, remove_roll };