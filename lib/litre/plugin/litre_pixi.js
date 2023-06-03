// integrate PIXI.js with some convenient wrappers
// copyright 2023 Samuel Baird MIT Licence

// NOTE: to use this plugin you must also load the pixi library (eg. from CDN)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js"></script>

import * as litre from '../litre.js';
import * as event_dispatch from './event_dispatch.js';
import * as ui from './litre_pixi_ui.js';

// top level pixi objects
export let app = null;
export let screen = null;

// -- screen size handling -------------------------------------------------

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
		// console.log('pixi_screen: dom(' + canvas_width + ', ' + canvas_height + ') logical(' + screen_width + ', ' + screen_height + ') scale: ' +screen_scale);
	} else {
		screen_width = canvas_width;
		screen_height = canvas_height;
		screen_scale = 1;
		// console.log('pixi_screen: (' + canvas_width + ', ' + canvas_height + ')');
	}
	
	PIXI.Text.defaultResolution = screen_scale * 1.25;
	PIXI.Text.defaultAutoResolution = false;
}

// -- asset tracking --------------------------------------------------

export const animations = {}
export const font_styles = {}

export const assets = {
	
	load_json: async (name) => {
		const response = await fetch(name);
		return await response.json();
	},
	
	load_spritesheet: async (name) => {
		const spritesheet = await PIXI.Assets.load(name);
		// check for additional animation data in the json
		// the data for the sprite gets typecast in pixi TS code and loses information, so we have to query it again
		const json = await assets.load_json(name);
		if (json.clips) {
			for (const k in json.clips) {
				animations[k] = json.clips[k];
			}
		}
		return spritesheet;
	},
	
	// load image
	// load font
	
	// set named font style
	set_font_style: (name, props) => {
		font_styles[name] = props;
	},
	
	// set named colours	
	// get plain colour textures?
		
}

// set some default fonts
assets.set_font_style('default', { align: 'center', fill: 0xffffff, fontFamily: 'Tahoma, sans', fontWeight: 'normal', fontSize: 11, padding: 4 });
assets.set_font_style('button', { align: 'center', fill: 0x000000, fontFamily: 'Tahoma, sans', fontWeight: 'normal', fontSize: 11, padding: 4 });

// animated clip
class pixi_clip extends PIXI.Container {
	
	constructor () {
		super();
		this.playback_speed = 1;
		this.playback_position = 0;
		this.playback_length = 0;
		this.is_playing = false;
		
		this.fps = 0;
		this.frames = [];
		this.current_frame = null;
		this.loop = true;
	}

	stop () {
		this.is_playing = false;
	}
	
	play (animation, loop_or_oncomplete) {
		if (typeof animation == 'string') {
			animation = animations[animation];
		}
		
		this.is_playing = true;
		this.fps = animation ? animation.fps : 1;
		this.frames = animation ? animation.frames : [];
		this.playback_position = 0;
		this.playback_length = (this.frames.length / this.fps);
		
		if (typeof loop_or_oncomplete == 'boolean') {
			this.loop = loop_or_oncomplete;
			this.on_complete = null;
		} else {
			this.loop = false;
			this.on_complete = loop_or_oncomplete;
		}
		
		this.set_frame(this.frames[0]);
	}

	update_animation (delta, with_callbacks) {
		if (!this.is_playing || this.playback_length == 0) {
			return;
		}

		this.playback_position += (this.playback_speed * delta);
		let target_frame = Math.floor(this.playback_position * this.fps);
		
		if (this.playback_position >= this.playback_length) {
			if (this.loop) {
				while (this.playback_position > this.playback_length) {
					this.playback_position -= this.playback_length;
					target_frame -= this.frames.length;
				}
			} else {
				this.playback_position = this.playback_length
				this.is_playing = false;
				target_frame = this.frames.length - 1;
			}
		}
		
		const frame = this.frames[target_frame];
		if (frame != this.current_frame) {
			this.set_frame(frame);
		}

		if (!this.is_playing) {
			if (this.on_complete) {
				with_callbacks(this.on_complete);
				this.on_complete = null;
			}
		}
	}

	set_frame (frame) {
		if (!frame) {
			this.removeChildren();
			return;
		}
		this.current_frame = frame;
		
		// if the frame is a simple single image frame
		if (typeof frame == 'string') {
			this.removeChildren();
			this.addChild(PIXI.Sprite.from(frame));
			return;
		}
		
		// TODO: port flash style animation (recursive tree) this from letter-js
		// create a map of all existing child objects (by instance name if given)
		// apply from back to front all specified children for this animation frame, reusing existing where instance name matches
		// setting transforms and frame number from animation data
		// remove any previous child objects not carried through
	}
	
}

// -- wrapped behaviour convenient pixi view ---------------------------

function apply_standard_parameters (pixi_obj, item) {
	pixi_obj.position.set(item.x ?? 0, item.y ?? 0);
	pixi_obj.scale.set(item.scale_x ?? item.scale ?? 1, item.scale_y ?? item.scale ?? 1);
	pixi_obj.alpha = item.alpha ?? 1;
	pixi_obj.rotation = item.rotation ?? 0;
}

class pixi_view extends PIXI.Container {
	
	constructor (node) {
		super();
		this.app = app;
		this.assets = assets;
		this.node = node;
		
		// created elements
		this.created_elements = [];
		
		// we're not using the pixi event system
		this.eventMode = 'none';
	}
	
	clear () {
		// remove all created items and clear references
		for (const created of this.created_elements) {
			if (created.id && this[created.id] == created.display) {
				delete this[created.id];
			}
			created.display.removeFromParent();
		}
		this.created_elements = [];
	}
	
	create (item) {
		// allow composition by array or function
		if (Array.isArray(item)) {
			const results = [];
			for (const entry of item) {
				results.push(this.create(entry));
			}
			return results;
		} else if (item instanceof Function) {
			return this.create(item());
		}
		
		// expand convenience items that are macros
		if (item.greybox_button) {
			// check font, width, height, and convert to up/down states
			const font = item.font ?? 'button';
			const color = item.color ?? 'black';
			const width = item.width ?? 120;
			const height = item.height ?? 30;
			const text = item.greybox_button;
			// wire up the button if on_click is provided
			item.greybox_button = null;
			item.children = item.children ?? [];
			item.children.push({ id: 'up', children: [
				{ rect: 0xeeeeee, width: width, height: height },
				{ text: text, font: font, align: 'center', color: color, x: width * 0.5, y: height * 0.5 },				
			]});
			item.children.push({ id: 'down', children: [
				{ rect: 0xbbbbbb, width: width, height: height },
				{ text: text, font: font, align: 'center', color: color, x: width * 0.5, y: height * 0.5 },				
			]});
		}
		if (item.up) {
			item.children = item.children ?? [];
			item.children.push({ id: 'up', children: item.up });
			item.up = null;
		}
		if (item.down) {
			item.children = item.children ?? [];
			item.children.push({ id: 'down', children: item.down });
			item.down = null;
		}		
		
		// render pixi objects from a description
		let parent = this;
		let reference = null;
		let revert_parent = null;
		
		if (item.children) {
			// if this item has children then all its content must be in a new subview
			const view = new pixi_view(this.node);
			apply_standard_parameters(view, item);
			this.addChild(view);
			revert_parent = parent;
			parent = view;
			reference = view;
		}

		if (item.rect) {
			const rectangle = PIXI.Sprite.from(PIXI.Texture.WHITE);
			apply_standard_parameters(rectangle, item);
			if (item.width) {
				rectangle.width = item.width;
			}
			if (item.height) {
				rectangle.height = item.height;
			}
			rectangle.tint = item.rect ?? 0xFFFFFF;
			parent.addChild(rectangle);
		}
		if (item.sprite) {
			// load the image a the appropriate place
			const sprite = PIXI.Sprite.from(item.sprite);
			apply_standard_parameters(sprite, item);
			parent.addChild(sprite);
			reference = sprite;
		}
		if (item.clip) {
			// load the image a the appropriate place
			const clip = new pixi_clip();
			apply_standard_parameters(clip, item);
			clip.play(item.clip, item.loop ?? item.on_complete);
			parent.addChild(clip);
			reference = clip;
		}
		if (item.text) {
			const style = Object.assign({}, font_styles[item.font ?? 'default']);
			if (item.color) {
				style.fill = item.color;
			}
			const text = new PIXI.Text(item.text, style);
			if (item.align == 'center') {
				text.anchor.set(0.5);
			}
			apply_standard_parameters(text, item);
			parent.addChild(text);
			reference = text;
		}
		if (item.children) {
			// create another child pixi view and create its child elements
			parent.create(item.children);
		}
		
		// if we were making sub-objects allow backing out before we set references and return
		if (revert_parent) {
			reference = parent;
			parent = revert_parent;
		}
		
		// set references on the node if appropriate
		if (reference && item.id && !this.node[item.id])	{
			parent[item.id] = reference;
		}

		// track for removing later if needed
		if (reference) {
			this.created_elements.push({
				id: item.id,
				display: reference,
			});
		}
		
		return reference;
	}
	
	add_touch_area (target, bounds_or_padding) {
		// convert a canvas co-ord to target space
		const point_conversion = (point) => {
			return target.toLocal(point);
		}
		
		// how do we determine what points are in bounds
		let area_test = null;
		if (bounds_or_padding instanceof PIXI.Rectangle) {
			area_test = (point) => {
				return bounds_or_padding.contains(point.x, point.y);
			}
			
		} else {
			bounds_or_padding = bounds_or_padding ?? 0;
			area_test = (point) => {
				const rect = target.getLocalBounds();
				rect.pad(bounds_or_padding);
				return rect.contains(point.x, point.y);
			}
		}
		
		return this.node.add_disposable(new ui.touch_area(point_conversion, area_test, this.node.context.get('event_dispatch')));
	}
	
	add_button (target, on_click) {
		const touch_area = this.add_touch_area(target);
		return this.node.add_disposable(new ui.button(target, touch_area, this.node.get_frame_dispatch(), on_click));
	}
	
	dispose () {
		this.removeFromParent();
	}
}

function update_animation_views(view, delta, with_callbacks) {
	if (view instanceof pixi_clip) {
		view.update_animation(delta, with_callbacks)
	} else if (view.children) {
		for (const child of view.children) {
			update_animation_views(child, delta, with_callbacks);
		}
	}
}

function update_animation_nodes(node, delta) {
	if (node.pixi_view) {
		let callbacks = null;
		update_animation_views(node.pixi_view, delta, (callback) => {
			if (!callbacks) {
				callbacks = [];
			}
			callbacks.push(callback);
		});
		if (callbacks) {
			for (let i = callbacks.length - 1; i >= 0; i--) {
				callbacks[i]();
			}
		}
	}
	if (node.children) {
		node.children.update((child) => {
			update_animation_nodes(child, delta);
		});
	}
}

// -- install the plugin with litre ------------------------------------

function initialise_plugin(canvas, pixi_options) {
	// don't initialise twice
	if (app) {
		return;
	}
	
	app = new PIXI.Application(pixi_options);
	if (!app.view.parentNode) {
		document.body.appendChild(app.view);
	}
	// set up a screen fit top level container
	screen = new PIXI.Container();
	app.stage.addChild(screen);
	resize_if_needed(true);
	
	const convert_touch = (touch) => {
		// scale to get position inside the canvas
		const bounds = canvas.getBoundingClientRect();		
		return {
			x: touch.x * (canvas.width / bounds.width),
			y: touch.y * (canvas.height / bounds.height),
			id: touch.id,
			time: touch.time,
		};
	};
	
	// register the plugin with litre
	litre.add_plugin({
		attach: (litre_app) => {
			// use litre touch handler at the top level only
			// these will be converted by event handlers into the local co-ords of pixi touch areas
			// TODO: might need to use a more raw event handler here to allow multitouch events through
			litre_app.wrap(canvas).touch_area(
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_BEGIN, convert_touch(touch)); },
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_MOVE, convert_touch(touch)); },
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_END, convert_touch(touch)); },
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_CANCEL, convert_touch(touch)); });
		},
		begin: (node) => {
			node.pixi_view = new pixi_view(node);
			// add to the parent by default
			const parent = node.context.get('pixi_view');
			if (parent) {
				parent.addChild(node.pixi_view);
			} else {
				screen.addChild(node.pixi_view);
			}
			node.context.set('pixi_view', pixi_view);
			node.add_disposable(node.pixi_view);
		},
		prerender: (litre_app) => {
			resize_if_needed(false);
		},
		update: (litre_app) => {
			// walk the node tree to update animations, trigger callbacks etc.
			update_animation_nodes(litre_app, litre_app.context.get('update_delta'));
		},
		postrender: (litre_app) => {
			app.render();
		},
	});
	
	event_dispatch.initialise_plugin();
}

export { initialise_plugin, set_logical_size, pixi_view, ui };