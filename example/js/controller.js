// Copyright 2022 Samuel Baird
import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';

let assets_are_loaded = false;
let settings = {};

function set_assets_are_loaded() {
	assets_are_loaded = true;
}

function app_state () {
	if (!assets_are_loaded) {
		return state.atom('loading_state');
	} else {
		return state.atom('app_state', { settings: settings });
	}
}

// reload the current settings from browser storage
const saved_settings = JSON.parse(window.localStorage.getItem('dice_roller_settings'));
if (saved_settings != null) {
	settings = saved_settings;
}

function save_settings(settings) {
	window.localStorage.setItem('dice_roller_settings', JSON.stringify(settings));
}

export { app_state, set_assets_are_loaded, save_settings };