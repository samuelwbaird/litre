// integrate PIXI.js with some convenient wrappeds
// copyright 2023 Samuel Baird MIT Licence

// NOTE: to use this plugin you must also load the pixi library (eg. from CDN)
// <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.2.4/pixi.min.js" crossorigin="anonymous"></script>

import * as litre from '../litre.js';

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
		console.log('pixi_screen: dom(' + canvas_width + ', ' + canvas_height + ') logical(' + screen_width + ', ' + screen_height + ') scale: ' + screen_scale);
	} else {
		screen_width = canvas_width;
		screen_height = canvas_height;
		screen_scale = 1;
		console.log('pixi_screen: (' + canvas_width + ', ' + canvas_height + ')');
	}
	
	PIXI.Text.defaultResolution = screen_scale;
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
	// load audio
	
	// set named font style
	set_font_style: (name, props) => {
		font_styles[name] = props;
	},
	
	// set named colours	
	// get plain colour textures?
		
}

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
				target_frame = this.frame.length - 1;
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
		
		if (typeof frame == 'string') {
			// simple sprite per frame animation
			this.removeChildren();
			this.addChild(PIXI.Sprite.from(frame));
			return;
		}
		
		// flash style animation updates (recursive tree of positioned items)
		// TODO: port this from letter-js

		/*
		// -- retain a list of current content (re-use objects where they match)
		const current = new Map();
		for (const [index, child] of this.children.entries()) {
			if (child.name) {
				current.set(child.name, child);
			} else {
				current.set('__' + index, child);
			}
		}

		// -- recreate the child display list, re-using objects
		for (const [index, content] of frame.content.entries()) {
			let child = current.get(content.instance_name);

			// check if types match before re-using an existing
			if (child) {
				if (content.image_data) {
					if (child.image_data != content.image_data) {
						child = null;
					}
				} else if (content.clip_data) {
					if (child.clip_data != content.clip_data) {
						child = null;
					}
				}
			}

			// re-use existing
			if (child) {
				// -- move it to the correct index
				this.children[index] = child;
				// -- make sure this is not removed later
				current.delete(content.instance_name);
			} else {
				// -- create a new child clip
				if (content.image_data) {
					child = new image(content.image_data);
				} else if (content.clip_data) {
					child = new clip(content.clip_data);
					// -- if frame is not specified then the sub clip should play
					if (!content.frame_no) {
						child.play();
					}
				} else {
					// defaults to empty display list
					child = new display_list();
				}
				child.name = content.instance_name;
				child.parent = this;
				this.children[index] = child;
			}

			// -- apply the new transform
			child.x = content.x;
			child.y = content.y;
			child.scale_x = content.scale_x;
			child.scale_y = content.scale_y;
			child.rotation = content.rotation;
			child.alpha = content.alpha;
			if (content.frame_no) {
				child.goto_and_stop(content.frame_no);
			}
		}

		// -- trim extra child references
		this.children.splice(frame.content.length);
		for (const child of current.values()) {
			child.parent = null;
		}
		*/
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
		
		// this is assuming we replace the touch system which we might not
		this.eventMode = 'none';
	}
	
	create (description) {
		// render pixi objects from a description
		for (const item of description) {
			let reference = null;
			if (item.children) {
				// create another child pixi view and create its child elements
				const view = new pixi_view(this.node);
				apply_standard_parameters(view, item);
				this.addChild(text);
				view.create(item.children);
				reference = view;		
			}
			if (item.sprite) {
				// load the image a the appropriate place
				const sprite = PIXI.Sprite.from(item.sprite);
				apply_standard_parameters(sprite, item);
				this.addChild(sprite);
				reference = sprite;
			}
			if (item.clip) {
				// load the image a the appropriate place
				const clip = new pixi_clip();
				apply_standard_parameters(clip, item);
				clip.play(item.clip, true);
				this.addChild(clip);
				reference = clip;
			}
			if (item.text) {
				const text = new PIXI.Text(item.text, font_styles[item.font]);
				if (item.align == 'center') {
					text.anchor.set(0.5);
				}
				apply_standard_parameters(text, item);
				this.addChild(text);
				reference = text;
			}
			// set references on the node if appropriate
			if (reference && item.id && !this.node[item.id])	{
				this.node[item.id] = reference;
			}
		}
		return this;
	}
	
	dispose () {
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

// TODO: a touch dispatch and handler
// TODO: touch area
// TODO: button

// -- install the plugin with litre ------------------------------------

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
			// TODO: display touch handlers			
			
			// walk the node tree to update animations, trigger callbacks etc.
			update_animation_nodes(litre_app, litre_app.context.get('update_delta'));
		},
		postrender: (litre_app) => {
			app.render();
		},
	});
}

export { initialise_plugin, set_logical_size, pixi_view };