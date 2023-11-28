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
export let screenWidth = 0;
export let screenHeight = 0;
export let screenScale = 1;

// scaling will be updated to fit this screen size
let canvasWidth = undefined;
let canvasHeight = undefined;
let logicalWidth = undefined;
let logicalHeight = undefined;
let maxLogicalWidth = undefined;
let maxLogicalHeight = undefined;

function setLogicalSize (width, height, maxWidth, maxHeight) {
	logicalWidth = width;
	logicalHeight = height;
	maxLogicalWidth = maxWidth;
	maxLogicalHeight = maxHeight;
	resizeIfNeeded(true);
}

function resizeIfNeeded (force) {
	if (!force && app.view.width == canvasWidth && app.view.height == canvasHeight) {
		return;
	}

	// record the current canvas size
	canvasWidth = app.view.width;
	canvasHeight = app.view.height;
	app.renderer.resize(canvasWidth, canvasHeight);

	if (logicalWidth) {
		screenScale = Math.min(canvasWidth / logicalWidth, canvasHeight / logicalHeight);
		screenWidth = Math.round(canvasWidth / screenScale);
		screenHeight = Math.round(canvasHeight / screenScale);
		screen.scale.set(screenScale);

		// mask and offset screenspace if either dimension is beyond max
		if (screen.mask) {
			screen.mask.removeFromParent();
		}
		if (maxLogicalWidth !== undefined && maxLogicalWidth < screenWidth) {
			screen.x = Math.floor((screenWidth - maxLogicalWidth) * 0.5 * screenScale);
			screen.mask = new PIXI.Graphics().beginFill(0x00ffff, 0.33).drawRect(0, 0, maxLogicalWidth, screenHeight);
			screen.addChild(screen.mask);
			screenWidth = maxLogicalWidth;
		} else if (maxLogicalHeight !== undefined && maxLogicalHeight < screenHeight) {
			screen.y = Math.floor((screenHeight - maxLogicalHeight) * 0.5 * screenScale);
			screen.mask = new PIXI.Graphics().beginFill(0x00ffff, 0.33).drawRect(0, 0, screenWidth, maxLogicalHeight);
			screen.addChild(screen.mask);
			screenHeight = maxLogicalHeight;
		}
		// console.log('pixi_screen: dom(' + canvasWidth + ', ' + canvasHeight + ') logical(' + screenWidth + ', ' + screenHeight + ') scale: ' +screenScale);
	} else {
		screenWidth = canvasWidth;
		screenHeight = canvasHeight;
		screenScale = 1;
		// console.log('pixi_screen: (' + canvasWidth + ', ' + canvasHeight + ')');
	}

	PIXI.Text.defaultResolution = screenScale * 1.25;
	PIXI.Text.defaultAutoResolution = false;
}

// -- asset tracking --------------------------------------------------

export const animations = {};
export const fontStyles = {};

export const assets = {

	loadJson: async (name) => {
		const response = await fetch(name);
		return await response.json();
	},

	loadSpritesheet: async (name) => {
		const spritesheet = await PIXI.Assets.load(name);
		// check for additional animation data in the json
		// the data for the sprite gets typecast in pixi TS code and loses information, so we have to query it again
		const json = await assets.loadJson(name);
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
	setFontStyle: (name, props) => {
		fontStyles[name] = props;
	},

	// set named colours
	// get plain colour textures?

};

// set some default fonts
assets.setFontStyle('default', { align: 'center', fill: 0xffffff, fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: 11, padding: 4 });
assets.setFontStyle('button', { align: 'center', fill: 0x000000, fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: 11, padding: 4 });

// animated clip
class PixiClip extends PIXI.Container {

	constructor () {
		super();
		this.playbackSpeed = 1;
		this.playbackPosition = 0;
		this.playbackLength = 0;
		this.isPlaying = false;

		this.fps = 0;
		this.frames = [];
		this.currentFrame = null;
		this.loop = true;
	}

	stop () {
		this.isPlaying = false;
	}

	play (animation, loopOrOncomplete) {
		if (typeof animation == 'string') {
			animation = animations[animation];
		}

		this.fps = animation ? animation.fps : 1;
		this.frames = animation ? animation.frames : [];
		this.playbackPosition = 0;
		this.playbackLength = (this.frames.length / this.fps);
		this.isPlaying = this.frames.length > 0;

		if (typeof loopOrOncomplete == 'boolean') {
			this.loop = loopOrOncomplete;
			this.onComplete = null;
		} else {
			this.loop = false;
			this.onComplete = loopOrOncomplete;
		}

		this.setFrame(this.frames[0]);
	}

	randomOffsetLoop () {
		// random offset a looping animation
		this.playbackPosition = Math.random() * this.playbackLength;
		this.setFrame(this.frames[Math.floor(this.playbackPosition)]);
	}

	playNext (animation, loopOrOncomplete) {
		if (!this.isPlaying) {
			return this.play(animation, loopOrOncomplete);
		}

		// don't loop the current animation
		this.loop = false;
		const oldOncomplete = this.onComplete;
		this.onComplete = () => {
			oldOncomplete?.();
			this.play(animation, loopOrOncomplete);
		};
	}

	updateAnimation (delta, withCallbacks) {
		if (!this.isPlaying || this.playbackLength == 0) {
			return;
		}

		this.playbackPosition += (this.playbackSpeed * delta);
		let targetFrame = Math.floor(this.playbackPosition * this.fps);

		if (this.playbackPosition >= this.playbackLength) {
			if (this.loop) {
				while (this.playbackPosition > this.playbackLength) {
					this.playbackPosition -= this.playbackLength;
					targetFrame -= this.frames.length;
				}
			} else {
				this.playbackPosition = this.playbackLength;
				this.isPlaying = false;
				targetFrame = this.frames.length - 1;
			}
		}

		const frame = this.frames[targetFrame];
		if (frame != this.currentFrame) {
			this.setFrame(frame);
		}

		if (!this.isPlaying) {
			if (this.onComplete) {
				withCallbacks(this.onComplete);
				this.onComplete = null;
			}
		}
	}

	setFrame (frame) {
		if (!frame) {
			this.removeChildren();
			return;
		}
		this.currentFrame = frame;

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

class PixiView extends PIXI.Container {

	constructor (node) {
		super();
		this.app = app;
		this.assets = assets;
		this.node = node;

		// created elements
		this.createdElements = [];

		// we're not using the pixi event system
		this.eventMode = 'none';
	}

	get linearScale () {
		return (this.scale.x + this.scale.y) * 0.5;
	}

	set linearScale (value) {
		this.scale.set(value, value);
	}

	sendToBack (child) {
		if (child) {
			this.removeChild(child);
			this.addChildAt(child, 0);
		} else {
			this.parent.sendToBack(this);
		}

	}

	sendToFront (child) {
		if (child) {
			// forces to front
			this.addChild(child);
		} else {
			this.parent.sendToFront(this);
		}
	}

	addToSpec (pixiObj, spec) {
		spec = spec ?? {};
		// apply standard properties shared by most objects
		if (spec) {
			pixiObj.position.set(spec.x ?? 0, spec.y ?? 0);
			pixiObj.scale.set(spec.scaleX ?? spec.scale ?? 1, spec.scaleY ?? spec.scale ?? 1);
			pixiObj.alpha = spec.alpha ?? 1;
			pixiObj.rotation = spec.rotation ?? 0;
			pixiObj.visible = (spec.visible !== undefined ? spec.visible : true);

			// set a reference if given
			if (spec.id && !this[spec.id]) {
				this[spec.id] = pixiObj;
			}
		}

		// add to scene tree
		this.addChild(pixiObj);

		// allow clean up
		this.createdElements.push({
			id: spec ? spec.id : null,
			display: pixiObj,
		});

		return pixiObj;
	}

	// individual creator/adder functions
	addSubview (spec) {
		return this.addToSpec(new PixiView(this.node), spec);
	}

	addRect (spec) {
		const rectangle = this.addToSpec(PIXI.Sprite.from(PIXI.Texture.WHITE), spec);
		if (spec.width) {
			rectangle.width = spec.width;
		}
		if (spec.height) {
			rectangle.height = spec.height;
		}
		rectangle.tint = spec.rect ?? spec.color ?? 0xFFFFFF;
		return rectangle;
	}

	addSprite (spec) {
		return this.addToSpec(PIXI.Sprite.from(spec.sprite), spec);
	}

	addClip (spec) {
		const clip = this.addToSpec(new PixiClip(), spec);
		clip.play(spec.clip, spec.loop ?? spec.onComplete);
	}

	addText (spec) {
		// base font spec
		const style = Object.assign({}, fontStyles[spec.font ?? 'default']);
		// style object
		if (spec.style) {
			Object.assign(style, spec.style);
		}
		// overrides in the spec
		Object.assign(style, spec);

		if (spec.color) {
			style.fill = spec.color;
		}
		if (spec.wordWrap) {
			style.wordWrap = true;
			style.wordWrapWidth = spec.wordWrap;
			style.breakWords = true;
		}
		if (spec.lineHeight) {
			style.lineHeight = spec.lineHeight;
		}
		const text = this.addToSpec(new PIXI.Text(spec.text, style), spec);
		if (style.align == 'center') {
			text.anchor.set(0.5);
		} else if (style.align == 'right') {
			text.anchor.set(1, 0);
		} else if (style.align == 'left') {
			text.anchor.set(0, 0);
		}
		return text;
	}

	addFill (color, alpha) {
		const screen = this.node.screen;
		return this.addRect({ x: 0, y: 0, width: screen.screenWidth, height: screen.screenHeight, color: color, alpha: alpha });
	}

	createButton (spec) {
		// convenient greybox buttons
		if (spec.greyboxButton) {
			spec.text = spec.greyboxButton;
			spec.colorUp = 0xeeeeee;
			spec.colorDown = 0xbbbbbb;
			spec.font = spec.font ?? 'button';
			spec.color = spec.color ?? 'black';
		}

		// create a button with up and down states as child elements
		const button = this.addSubview({
			// the id will be the button id
			id: spec.id ?? spec.button,
			x: spec.x,
			y: spec.y,
			alpha: spec.alpha,
			visible: spec.visible,
			scale: spec.scale,
			rotation: spec.rotation,
		});

		// button expects two child views
		const down = button.addSubview({ id: 'down', visible : false });
		const up = button.addSubview({ id: 'up' });

		// what width and height are we using (default, or set by the image if not given)
		let width = spec.width;
		let height = spec.height;
		if (spec.imageUp) {
			const imageUp = up.addSprite({
				sprite: spec.imageUp,
			});
			width = width ?? imageUp.width;
			height = height ?? imageUp.height;
		}
		if (spec.imageDown) {
			down.addSprite({ sprite: spec.imageDown });
		}

		// set a default/debug width and height if not given
		width = width ?? 120;
		height = height ?? 30;

		// add plain colour backing if called for
		if (spec.colorDown) {
			down.addRect({ rect: spec.colorDown, width: width, height: height });
		}
		if (spec.colorUp) {
			up.addRect({ rect: spec.colorUp, width: width, height: height });
		}

		// add text label if called for
		if (spec.text) {
			const textSpec = { ...spec, id: 'text' };
			textSpec.x = width * 0.5;
			textSpec.y = height * 0.5;
			textSpec.align = 'center';
			up.addText(textSpec);
			down.addText(textSpec);
		}

		if (spec.action) {
			button.button = this.addButton(button, spec.action);
		}
		return button;
	}

	// remove all created items and clear references
	clear () {
		for (const created of this.createdElements) {
			if (created.id && this[created.id] == created.display) {
				delete this[created.id];
			}
			created.display.removeFromParent();
		}
		this.createdElements = [];
	}

	// compount creation, either a single spec, or an array of specs
	create (spec) {
		// allow composition by array or function
		if (Array.isArray(spec)) {
			const results = [];
			for (const entry of spec) {
				results.push(this.create(entry));
			}
			return results;
		} else if (spec instanceof Function) {
			return this.create(spec());
		}

		if (spec.button !== undefined || spec.greyboxButton !== undefined) {
			return this.createButton(spec);

		} else if (spec.children !== undefined) {
			// if this spec has children then all its content must be in a new subview
			const view = this.addSubview(spec);
			view.create(spec.children);
			return view;

		} else if (spec.fill !== undefined) {
			spec.x = -this.x;
			spec.y = -this.y;
			spec.width = this.node.screen.screenWidth;
			spec.height = this.node.screen.screenHeight;
			spec.color = spec.fill;
			return this.addRect(spec);

		} else if (spec.rect !== undefined) {
			return this.addRect(spec);

		} else if (spec.sprite !== undefined) {
			return this.addSprite(spec);

		} else if (spec.clip !== undefined) {
			return this.addClip(spec);

		} else if (spec.text !== undefined) {
			return this.addText(spec);

		} else {
			console.assert('unrecognised pixiview spec');
		}
	}

	addTouchArea (target, boundsOrPadding) {
		// convert a canvas co-ord to target space
		const pointConversion = (point) => {
			return target.toLocal(point);
		};

		// how do we determine what points are in bounds
		let areaTest = null;
		if (boundsOrPadding instanceof PIXI.Rectangle) {
			areaTest = (point) => {
				return boundsOrPadding.contains(point.x, point.y);
			};

		} else {
			boundsOrPadding = boundsOrPadding ?? 0;
			areaTest = (point) => {
				const rect = target.getLocalBounds();
				rect.pad(boundsOrPadding);
				return rect.contains(point.x, point.y);
			};
		}

		return this.node.addDisposable(new ui.TouchArea(pointConversion, areaTest, this.node.context.get('event_dispatch')));
	}

	addButton (target, onClick) {
		const touchArea = this.addTouchArea(target);
		return this.node.addDisposable(new ui.Button(target, touchArea, this.node.getFrameDispatch(), onClick));
	}

	dispose () {
		this.removeAllListeners();
		this.removeFromParent();
	}
}

function updateAnimationViews (view, delta, updated, withCallbacks) {
	if (view instanceof PixiClip) {
		if (!updated.has(view)) {
			updated.add(view);
			view.updateAnimation(delta, withCallbacks);
		}
	} else if (view.children) {
		for (const child of view.children) {
			updateAnimationViews(child, delta, updated, withCallbacks);
		}
	}
}

function updateAnimationNodes (node, delta, updated) {
	if (node.pixiView) {
		let callbacks = null;
		updateAnimationViews(node.pixiView, delta, updated, (callback) => {
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
			updateAnimationNodes(child, delta, updated);
		});
	}
}

// -- install the plugin with litre ------------------------------------

function initialisePlugin (canvas, pixiOptions) {
	// don't initialise twice
	if (app) {
		return;
	}

	app = new PIXI.Application(pixiOptions);
	if (!app.view.parentNode) {
		document.body.appendChild(app.view);
	}
	// set up a screen fit top level container
	screen = new PIXI.Container();
	app.stage.addChild(screen);
	resizeIfNeeded(true);

	const convertTouch = (touch) => {
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
	litre.addPlugin({
		attach: (litreApp) => {
			// use litre touch handler at the top level only
			// these will be converted by event handlers into the local co-ords of pixi touch areas
			// TODO: might need to use a more raw event handler here to allow multitouch events through
			litreApp.wrap(canvas).touchArea(
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_BEGIN, convertTouch(touch)); },
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_MOVE, convertTouch(touch)); },
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_END, convertTouch(touch)); },
				(touch) => { event_dispatch.shared.defer(ui.EVENT_TOUCH_CANCEL, convertTouch(touch)); });
		},
		begin: (node) => {
			node.pixiView = new PixiView(node);
			// add to the parent by default
			const parent = node.context.get('pixi_view');
			if (parent) {
				parent.addChild(node.pixiView);
			} else {
				screen.addChild(node.pixiView);
			}
			node.context.set('pixi_view', node.pixiView);
			node.addDisposable(node.pixiView);
		},
		prerender: (litreApp) => {
			resizeIfNeeded(false);
		},
		update: (litreApp) => {
			// walk the node tree to update animations, trigger callbacks etc.
			updateAnimationNodes(litreApp, litreApp.context.get('update_delta'), new Set());
		},
		postrender: (litreApp) => {
			app.render();
		},
	});

	event_dispatch.initialisePlugin();
}

export { initialisePlugin, setLogicalSize, PixiView, ui };
