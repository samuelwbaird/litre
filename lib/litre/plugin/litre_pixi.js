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
let canvasWidth = null;
let canvasHeight = null;
let logicalWidth = null;
let logicalHeight = null;

function setLogicalSize (width, height) {
	logicalWidth = width;
	logicalHeight = height;
	resizeIfNeeded(true);
}

function resizeIfNeeded (force) {
	if (!force && app.view.width == canvasWidth && app.view.height == canvasHeight) {
		return;
	}

	// record the current canvas size
	canvasWidth = app.view.width;
	canvasHeight = app.view.height;

	if (logicalWidth) {
		screenScale = Math.min(canvasWidth / logicalWidth, canvasHeight / logicalHeight);
		screenWidth = Math.round(canvasWidth / screenScale);
		screenHeight = Math.round(canvasHeight / screenScale);
		screen.scale.set(screenScale);
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
assets.setFontStyle('default', { align: 'center', fill: 0xffffff, fontFamily: 'Tahoma, sans', fontWeight: 'normal', fontSize: 11, padding: 4 });
assets.setFontStyle('button', { align: 'center', fill: 0x000000, fontFamily: 'Tahoma, sans', fontWeight: 'normal', fontSize: 11, padding: 4 });

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

function applyStandardParameters (pixiObj, item) {
	pixiObj.position.set(item.x ?? 0, item.y ?? 0);
	pixiObj.scale.set(item.scaleX ?? item.scale ?? 1, item.scaleY ?? item.scale ?? 1);
	pixiObj.alpha = item.alpha ?? 1;
	pixiObj.rotation = item.rotation ?? 0;
}

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

	clear () {
		// remove all created items and clear references
		for (const created of this.createdElements) {
			if (created.id && this[created.id] == created.display) {
				delete this[created.id];
			}
			created.display.removeFromParent();
		}
		this.createdElements = [];
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
		if (item.greyboxButton) {
			// check font, width, height, and convert to up/down states
			const font = item.font ?? 'button';
			const color = item.color ?? 'black';
			const width = item.width ?? 120;
			const height = item.height ?? 30;
			const text = item.greyboxButton;
			// wire up the button if onClick is provided
			item.greyboxButton = null;
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
		let revertParent = null;

		if (item.children) {
			// if this item has children then all its content must be in a new subview
			const view = new PixiView(this.node);
			applyStandardParameters(view, item);
			this.addChild(view);
			revertParent = parent;
			parent = view;
			reference = view;
			this.createdElements.push({
				id: item.id,
				display: reference,
			});
		}
		if (item.rect) {
			const rectangle = PIXI.Sprite.from(PIXI.Texture.WHITE);
			applyStandardParameters(rectangle, item);
			if (item.width) {
				rectangle.width = item.width;
			}
			if (item.height) {
				rectangle.height = item.height;
			}
			rectangle.tint = item.rect ?? 0xFFFFFF;
			parent.addChild(rectangle);
			reference = rectangle;
			this.createdElements.push({
				id: item.id,
				display: reference,
			});
		}
		if (item.sprite) {
			// load the image a the appropriate place
			const sprite = PIXI.Sprite.from(item.sprite);
			applyStandardParameters(sprite, item);
			parent.addChild(sprite);
			reference = sprite;
			this.createdElements.push({
				id: item.id,
				display: reference,
			});
		}
		if (item.clip || item.clip === '') {
			// load the image a the appropriate place
			const clip = new PixiClip();
			applyStandardParameters(clip, item);
			clip.play(item.clip, item.loop ?? item.onComplete);
			parent.addChild(clip);
			reference = clip;
			this.createdElements.push({
				id: item.id,
				display: reference,
			});
		}
		if (item.text || item.text === '') {
			const style = Object.assign({}, fontStyles[item.font ?? 'default']);
			if (item.color) {
				style.fill = item.color;
			}
			if (item.wordWrap) {
				style.wordWrap = true;
				style.wordWrapWidth = item.wordWrap;
				style.breakWords = true;
			}
			if (item.lineHeight) {
				style.lineHeight = item.lineHeight;
			}
			const text = new PIXI.Text(item.text, style);
			if (item.align == 'center') {
				text.anchor.set(0.5);
			}
			applyStandardParameters(text, item);
			parent.addChild(text);
			reference = text;
			this.createdElements.push({
				id: item.id,
				display: reference,
			});
		}
		if (item.children) {
			// create another child pixi view and create its child elements
			parent.create(item.children);
		}

		// if we were making sub-objects allow backing out before we set references and return
		if (revertParent) {
			reference = parent;
			parent = revertParent;
		}

		// set references on the node if appropriate
		if (reference && item.id && !this.node[item.id])	{
			parent[item.id] = reference;
		}

		return reference;
	}
	
	addSubview () {
		const view = new PixiView(this.node);
		this.addChild(view);
		return view;
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
