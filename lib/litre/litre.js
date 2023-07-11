// aggregate litre library as a module
// copyright 2022 Samuel Baird MIT Licence

import * as sequence from './sequence.js';
import * as dom from './dom.js';

let appInstance = null;

// plugins can provide hooks for the following
// {
//   attach: (app) => {},
//   begin: (node) => {},
//   prerender: (app) => {},
//   update: (app) => {},
//   postrender: (app) => {},
// }
const plugins = [];
function addPlugin (plugin) {
	plugins.push(plugin);
	if (appInstance) {
		plugin.attach?.(appInstance);
	}
}

function pluginsBegin (node) {
	for (const plugin of plugins) {
		plugin.begin?.(node);
	}
}

function pluginsPrerender (app) {
	for (const plugin of plugins) {
		plugin.prerender?.(app);
	}
}

function pluginsUpdate (app) {
	for (const plugin of plugins) {
		plugin.update?.(app);
	}
}

function pluginsPostrender (app) {
	for (const plugin of plugins) {
		plugin.postrender?.(app);
	}
}


class Context {

	constructor (parent) {
		this.parent = parent;
		this.flags = new Map();
	}

	derive () {
		return new Context(this);
	}

	root () {
		if (this.parent != null) {
			return this.parent.root();
		} else {
			return this;
		}
	}

	set (name, value) {
		this.flags.set(name, value);
		return value;
	}

	get (name, defaultValue = null) {
		if (this.flags.has(name)) {
			return this.flags.get(name);
		}
		if (this.parent) {
			return this.parent.get(name);
		}
		return defaultValue;
	}

}

class AppNode {

	// override
	begin () {
		pluginsBegin(this);
	}

	add (child) {
		if (!this.children) {
			this.children = new sequence.UpdateList();
		}
		this.children.add(child);

		child.context = this.context.derive();
		child.begin();

		return child;
	}

	remove (child) {
		if (!this.children) {
			return;
		}
		if (this.children.remove(child)) {
			child.dispose();
		}
	}

	removeAllChildren () {
		if (this.children) {
			const oldList = this.children;
			this.children = null;
			for (const updateListEntry of oldList.list) {
				updateListEntry.obj.dispose();
			}
		}
	}

	getTweenManager () {
		if (!this.tweenManager) {
			this.tweenManager = this.addDisposable(new sequence.TweenManager());
		}
		return this.tweenManager;
	}

	tween (target, easing, properties, optionalParams) {
		const t = new sequence.Tween(target, easing, properties, optionalParams);
		this.getTweenManager().add(t);
		return t;
	}

	getFrameDispatch () {
		if (!this.frameDispatch) {
			this.frameDispatch = this.addDisposable(new sequence.FrameDispatch());
		}
		return this.frameDispatch;
	}

	delay (count, fn, tag) {
		this.getFrameDispatch().delay(count, fn, tag);
	}

	hook (fn, tag) {
		this.getFrameDispatch().hook(fn, tag);
	}

	getCoroutineManager () {
		if (!this.coroutineManager) {
			this.coroutineManager = this.addDisposable(new sequence.CoroutineManager(this));
		}
		return this.coroutineManager;
	}

	run (generator, ...args) {
		this.getCoroutineManager().run(generator, this, ...args);
	}

	listen (element, event, callback) {
		this.wrap(element).listen(event, callback);
	}

	wrap (element) {
		element = dom.node(element);
		if (this.wrappedDomMap == null) {
			this.wrappedDomMap = new Map();
		}
		if (this.wrappedDomMap.has(element)) {
			return this.wrappedDomMap.get(element);
		}
		const wrapped = this.addDisposable(new dom.Wrap(this, element));
		this.wrappedDomMap.set(element, wrapped);
		return wrapped;
	}

	update () {
		if (this.tweenManager) {
			this.tweenManager.update();
		}
		if (this.coroutineManager) {
			this.coroutineManager.update();
		}
		if (this.frameDispatch) {
			this.frameDispatch.update();
		}
		if (this.children) {
			this.children.update((child) => {
				child.update();
			});
		}
	}

	addDisposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
		return disposable;
	}

	dispose () {
		if (this.children) {
			this.children.update((child) => {
				child.dispose();
			});
			this.children = null;
		}

		if (this.disposables) {
			for (const disposable of this.disposables) {
				if (typeof disposable == 'function') {
					disposable();
				} else if (disposable.dispose) {
					disposable.dispose();
				} else {
					throw 'cannot dispose ' + disposable;
				}
			}
			this.disposables = null;
		}
	}
}

class RenderCallback {
	constructor () {
		this.active = false;
	}

	start (callback) {
		this.callback = callback;
		this.active = true;
		window.requestAnimationFrame(() => {
			this.nextFrame();
		});
	}

	nextFrame () {
		if (!this.active) {
			return;
		}
		window.requestAnimationFrame(() => {
			this.nextFrame();
		});
		this.callback();
	}

	stop () {
		this.active = false;
		this.callback = null;
	}
}

class FixedRateTimer {
	constructor (fps, minFrames, maxFrames, resetFrames) {
		this.setFps(fps, minFrames, maxFrames, resetFrames);
	}

	setFps (fps, minFrames = 1, maxFrames = 4, resetFrames = 16) {
		this.fps = fps;
		this.delta = 1 / fps;
		this.minFrames = minFrames;
		this.maxFrames = maxFrames;
		this.resetFrames = resetFrames;
		this.reset();
	}

	reset () {
		this.lastTime = Date.now();
		this.timeAccumulated = 0;
	}

	getFramesDue () {
		const now = Date.now();
		const delta = (now - this.lastTime) / 1000.0;
		this.timeAccumulated += delta;
		this.lastTime = now;

		let framesDue = Math.floor(this.timeAccumulated * this.fps);

		if (this.resetFrames > 0 && framesDue > this.resetFrames) {
			this.timeAccumulated = 0;
			framesDue = 1;
		} else if (this.maxFrames > 0 && framesDue > this.maxFrames) {
			this.timeAccumulated = 0;
			framesDue = this.maxFrames;
		} else if (this.minFrames > 0 && framesDue < this.minFrames) {
			framesDue = 0;
		} else {
			this.timeAccumulated -= framesDue / this.fps;
		}

		return framesDue;
	}
}

class App extends AppNode {

	constructor () {
		super();
		this.context = new Context();
		this.context.set('app', this);
		this.scene = null;

		this.updateTimer = new FixedRateTimer();
		this.updateTimer.setFps(60, 1, 4, 16);

		this.renderCallback = new RenderCallback();
	}

	setDomScreen (element, logicalWidth, logicalHeight) {
		this.domScreen = this.context.set('dom_screen', new dom.Screen(element));
		this.domScreen.scaleToFit(logicalWidth, logicalHeight);
	}

	setScene (scene) {
		if (this.scene) {
			this.remove(this.scene);
		}
		this.scene = scene;
		if (scene) {
			this.add(scene);
		}
		return scene;
	}

	pause () {
		this.renderCallback.stop();
	}

	resume () {
		this.renderCallback.start(() => {
			this.onRender();
		});
	}

	onRender () {
		if (this.domScreen) {
			this.domScreen.update();
		}

		const framesDue = this.updateTimer.getFramesDue();
		if (framesDue > 0) {
			pluginsPrerender(this);
			for (let i = 0; i < framesDue; i++) {

				// let components optionally know more about the update cycle
				this.context.set('update_fps', this.updateTimer.fps);
				this.context.set('update_delta', this.updateTimer.delta);
				this.context.set('update_frame', i);
				this.context.set('update_frames_due', framesDue);

				pluginsUpdate(this);
				this.update();
			}
			pluginsPostrender(this);
		}
	}

}

function launchApp () {
	// create an launch the app with an empty scene
	appInstance = new App();
	appInstance.setScene(new AppNode());
	appInstance.resume();
	for (const plugin of plugins) {
		plugin.attach?.(appInstance);
	}
	return appInstance;
}

export { addPlugin, sequence, dom, Context, AppNode, App, launchApp };
