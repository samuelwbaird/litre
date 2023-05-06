// integrate PIXI.js with some convenient wrappeds
// copyright 2023 Samuel Baird MIT Licence

// NOTE: to use this plugin you must also load the pixi library (eg. from CDN)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js" crossorigin="anonymous"></script>

import * as litre from '../litre.js';

// top level pixi objects
export let app = null;
export let screen = null;

// current screen "size" for application code
export let screen_width = 0;
export let screen_height = 0;
export let screen_scale = 1;

// scaling will be updated to fit this screen size
let canvas_width = null;
let canvas_height = null;
let logical_width = null;
let logical_height = null;

function set_logical_size(width, height) {
	logical_width = width;
	logical_height = height;
	resize_if_needed(true);
}

function resize_if_needed(force) {
	if (!force && app.view.width == canvas_width && app.view.height == canvas_height) {
		return;
	}
	
	// record the current canvas size
	canvas_width = app.view.width;
	canvas_height = app.view.height;
	
	if (logical_width) {
		screen_scale = Math.min(canvas_width / logical_width, canvas_height / logical_height);
		screen_width = Math.round(canvas_width / screen_scale);
		screen_height = Math.round(canvas_height / screen_scale);
		screen.scale.set(screen_scale);
		console.log('pixi_screen: dom(' + canvas_width + ', ' + canvas_height + ') logical(' + screen_width + ', ' + screen_height + ') scale: ' + screen_scale);
	} else {
		screen_width = canvas_width;
		screen_height = canvas_height;
		screen_scale = 1;
		console.log('pixi_screen: (' + canvas_width + ', ' + canvas_height + ')');
	}
}

function initialise_plugin(canvas, pixi_options) {
	app = new PIXI.Application(pixi_options);
	if (!app.view.parentNode) {
		document.body.appendChild(app.view);
	}
	// set up a screen fit top level container
	screen = new PIXI.Container();
	app.stage.addChild(screen);
	resize_if_needed(true);
	
	// register the plugin with litre
	litre.add_plugin({
		// begin: (node) => {
		//
		// },
		prerender: (litre_app) => {
			resize_if_needed(false);
		},
		// update: (litre_app) => {
		//
		// },
		postrender: (litre_app) => {
			app.render();
		},
	});
}

export { initialise_plugin, set_logical_size };