// aggregate litre library as a module
// copyright 2022 Samuel Baird MIT Licence

import * as resource from './resource.js';
import * as sequence from './sequence.js';
import * as state from './state.js';
import * as dom from './dom.js';

class context {

	constructor (parent) {
		this.parent = parent;
		this.flags = new Map();
	}

	derive () {
		return new context(this);
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

	get (name, default_value = null) {
		if (this.flags.has(name)) {
			return this.flags.get(name);
		}
		if (this.parent) {
			return this.parent.get(name);
		}
		return default_value;
	}

}

class app_node {

	// override
	begin () {}

	add (child) {
		if (!this.children) {
			this.children = new sequence.update_list();
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

	remove_all_children () {
		if (this.children) {
			const old_list = this.children;
			this.children = null;
			for (const update_list_entry of old_list.list) {
				update_list_entry.obj.dispose();
			}
		}
	}

	get_tween_manager () {
		if (!this.tween_manager) {
			this.tween_manager = this.add_disposable(new sequence.tween_manager());
		}
		return this.tween_manager;
	}

	tween (target, easing, properties, optional_params) {
		const t = new sequence.tween(target, easing, properties, optional_params);
		this.get_tween_manager().add(t);
		return t;
	}

	get_frame_dispatch () {
		if (!this.frame_dispatch) {
			this.frame_dispatch = this.add_disposable(new sequence.frame_dispatch());
		}
		return this.frame_dispatch;
	}

	delay (count, fn, tag) {
		this.get_frame_dispatch().delay(count, fn, tag);
	}

	hook (fn, tag) {
		this.get_frame_dispatch().hook(fn, tag);
	}

	get_coroutine_manager () {
		if (!this.coroutine_manager) {
			this.coroutine_manager = this.add_disposable(new sequence.coroutine_manager(this));
		}
		return this.coroutine_manager;
	}

	run (generator, apply_this) {
		if (apply_this === true) {
			apply_this = this;
		}
		this.get_coroutine_manager().run(generator, apply_this);
	}

	get_dom (parent_element) {
		parent_element = (parent_element ? dom.node(parent_element) : this.context.get('dom_screen'));
		if (this.dom_map == null) {
			this.dom_map = new Map();
		}
		if (this.dom_map.has(parent_element)) {
			return this.dom_map.get(parent_element);
		}
		const dom_link = this.add_disposable(new dom.dom_link(this, parent_element));
		this.dom_map.set(parent_element, dom_link);
		return dom_link;
	}

	update () {
		if (this.tween_manager) {
			this.tween_manager.update();
		}
		if (this.coroutine_manager) {
			this.coroutine_manager.update();
		}
		if (this.frame_dispatch) {
			this.frame_dispatch.update();
		}
		if (this.children) {
			this.children.update((child) => {
				child.update();
			});
		}
	}

	add_disposable (disposable) {
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

class render_callback {
	constructor () {
		this.active = false;
	}

	start (callback) {
		this.callback = callback;
		this.active = true;
		window.requestAnimationFrame(() => {
			this.next_frame();
		});
	}

	next_frame () {
		if (!this.active) {
			return;
		}
		window.requestAnimationFrame(() => {
			this.next_frame();
		});
		this.callback();
	}

	stop () {
		this.active = false;
		this.callback = null;
	}
}

class fixed_rate_timer {
	constructor (fps, min_frames, max_frames, reset_frames) {
		this.set_fps(fps, min_frames, max_frames, reset_frames);
	}

	set_fps (fps, min_frames = 1, max_frames = 4, reset_frames = 16) {
		this.fps = fps;
		this.delta = 1 / fps;
		this.min_frames = min_frames;
		this.max_frames = max_frames;
		this.reset_frames = reset_frames;
		this.reset();
	}

	reset () {
		this.last_time = Date.now();
		this.time_accumulated = 0;
	}

	get_frames_due () {
		const now = Date.now();
		const delta = (now - this.last_time) / 1000.0;
		this.time_accumulated += delta;
		this.last_time = now;

		let frames_due = Math.floor(this.time_accumulated * this.fps);

		if (this.reset_frames > 0 && frames_due > this.reset_frames) {
			this.time_accumulated = 0;
			frames_due = 1;
		} else if (this.max_frames > 0 && frames_due > this.max_frames) {
			this.time_accumulated = 0;
			frames_due = this.max_frames;
		} else if (this.min_frames > 0 && frames_due < this.min_frames) {
			frames_due = 0;
		} else {
			this.time_accumulated -= frames_due / this.fps;
		}

		return frames_due;
	}
}

class app extends app_node {

	constructor () {
		super();
		this.context = new context();
		this.context.set('app', this);
		this.scene = null;

		this.update_timer = new fixed_rate_timer();
		this.update_timer.set_fps(60, 1, 4, 16);

		this.render_callback = new render_callback();
	}

	set_dom_screen (element, logical_width, logical_height) {
		this.dom_screen = this.context.set('dom_screen', new dom.screen(element));
		this.dom_screen.scale_to_fit(logical_width, logical_height);
	}

	set_scene (scene) {
		if (this.scene) {
			this.remove(this.scene);
		}
		this.scene = scene;
		if (scene) {
			this.add(scene);
		}
	}

	pause () {
		this.render_callback.stop();
	}

	resume () {
		this.render_callback.start(() => {
			this.on_render();
		});
	}

	on_render () {
		if (this.dom_screen) {
			this.dom_screen.update();
		}

		const frames_due = this.update_timer.get_frames_due();
		for (let i = 0; i < frames_due; i++) {

			// let components optionally know more about the update cycle
			this.context.set('update_fps', this.update_timer.fps);
			this.context.set('update_delta', this.update_timer.delta);
			this.context.set('update_frame', i);
			this.context.set('update_frames_due', frames_due);

			this.update();
		}
	}

}

function launch_app () {
	// create an launch the app with an empty scene
	const app_instance = new app();
	app_instance.set_scene(new app_node());
	app_instance.resume();
	return app_instance;
}

export { resource, sequence, state, dom, context, app_node, app, launch_app };