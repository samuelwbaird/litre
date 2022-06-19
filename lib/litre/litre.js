// aggregate litre library as a module
// copyright 2022 Samuel Baird MIT Licence

import * as resource from './resource.js';
import * as sequence from './sequence.js';
import * as state from './state.js';
import * as dom from './dom.js';

/*
:find a place for
 fixed rate timers
 update_list, dispatch, tween, coroutine

:rebuild
 context
 state

:create
 immutable tokens
 dom tools
 more state switching

 event propogate eg. on_render through tree?
	don't need an animation timer, until I know what pixi needs
	do sometimes need to only update on non-fixed, for example to track movement per frame under touch?

 touch events and sizing in the dom? wtf
 screen fit in the dom, wtf?


:don't find a place for
 not sure about event manager or old context
 geometry
 display
 ui.js

:in this file
 app_node
 app & launch app
 render callback goes directly in app
*/ 

// context
// app

// app_node:propogate
// frame_timer: (in context from app, include delta/frame count etc. for updates)

class context {

	constructor (parent) {
		this.parent = parent;
		this.flags = new Map();
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

	add (child, view_parent) {
		if (!this.children) {
			this.children = new dispatch.update_list();
		}
		this.children.add(child);

		child.context = new context(this.context);
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
			this.tween_manager = this.add_disposable(new tween.manager());
		}
		return this.tween_manager;
	}

	tween (target, easing, properties, optional_params) {
		const t = new tween.tween(target, easing, properties, optional_params);
		this.get_tween_manager().add(t);
		return t;
	}

	get_frame_dispatch () {
		if (!this.frame_dispatch) {
			this.frame_dispatch = this.add_disposable(new dispatch.frame_dispatch());
		}
		return this.frame_dispatch;
	}

	delay (count, fn, tag) {
		this.get_frame_dispatch().delay(count, fn, tag);
	}

	get_coroutine_manager () {
		if (!this.coroutine_manager) {
			this.coroutine_manager = this.add_disposable(new coroutine.coroutine_manager(this));
		}
		return this.coroutine_manager;
	}
	
	// run/schedule/execute (this.get_coroutine_manager.run(*))

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

class app extends app_node {
	
	constructor () {
		super();
		this.context = new context();
		this.scene = null;
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
	
}

export { resource, sequence, state, dom, context, app_node, app };


/*
// app_node, standard heavy weight object used to create a back bone heirachy of objects at runtime
// the app module also acts as a single instance of managing current scene, timer, events and screen fit
// the app is made of a tree of app_nodes, each heavy weight objects
// that delimit the lifetime and update cycle of their child objects

class app_node {

	constructor () {
		this.view = new display.display_list();

		this.tween_manager = null;
		this.frame_dispatch = null;

		this.children = null;
		this.disposables = null;
	}

	add_disposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
		return disposable;
	}

	// override
	prepare () {}
	begin () {}

	add (child, view_parent) {
		if (!this.children) {
			this.children = new dispatch.update_list();
		}
		this.children.add(child);

		child.app = this.app;
		child.screen = this.screen;
		child.context = this.context;

		// view_parent = false to not add, or this app_nodes view by default
		if (child.view != null) {
			child.prepare();

			if (view_parent == undefined) {
				view_parent = this.view;
			}
			if (view_parent) {
				view_parent.add(child.view);
			}

			// begin is called only once the view is added
			child.begin();
		}

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
			this.tween_manager = new tween.manager();
		}
		return this.tween_manager;
	}

	tween (target, easing, properties, optional_params) {
		const t = new tween.tween(target, easing, properties, optional_params);
		this.get_tween_manager().add(t);
		return t;
	}

	get_frame_dispatch () {
		if (!this.frame_dispatch) {
			this.frame_dispatch = new dispatch.frame_dispatch();
		}
		return this.frame_dispatch;
	}

	get_coroutine_manager () {
		if (!this.coroutine_manager) {
			this.coroutine_manager = new coroutine.coroutine_manager(this);
		}
		return this.coroutine_manager;
	}

	delay (count, fn, tag) {
		this.get_frame_dispatch().delay(count, fn, tag);
	}

	add_button (clip, action, init_values, context) {
		const btn = new ui.button(clip, action, init_values, (context != null) ? context : this.context);
		this.add_disposable(btn);
		return btn;
	}

	add_touch_area (display_object, padding, context) {
		const ta = ui.touch_area.bounds(display_object, padding, (context != null) ? context : this.context);
		this.add_disposable(ta);
		return ta;
	}

	add_touch_area_rect (display_object, x, y, width, height, context) {
		const ta = ui.touch_area.rect(display_object, new geometry.rect(x, y, width, height), (context != null) ? context : this.context);
		this.add_disposable(ta);
		return ta;
	}

	create_modal_context () {
		const modal_context = this.context.derive();
		this.add_disposable(modal_context);
		return modal_context;
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

	dispose () {
		if (this.view) {
			this.view.remove_from_parent();
		}

		if (this.children) {
			this.children.update((child) => {
				child.dispose();
			});
			this.children = null;
		}

		if (this.tween_manager) {
			this.tween_manager.dispose();
			this.tween_manager = null;
		}

		if (this.coroutine_manager) {
			this.coroutine_manager.dispose();
			this.coroutine_manager = null;
		}

		if (this.frame_dispatch) {
			this.frame_dispatch.dispose();
			this.frame_dispatch = null;
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

// there should generally be one app object at the root of the app_node tree
// tying it in with the rest of the browser environment

class app {

	constructor (screen) {
		this.render_callback = new ui.render_callback();
		this.fps = new ui.fixed_rate_timer(60);
		this.animation_fps = new ui.fixed_rate_timer(60);
		this.frame_dispatch = new dispatch.frame_dispatch();

		this.screen = screen;
		this.current_scene = null;

		this.context = new dispatch.context();

		if (this.screen) {
			this.screen.set_context(this.context);
		}
	}

	update () {
		// keep up to date with window size
		if (this.screen != null) {
			this.screen.update();
		}

		// animation frames
		let requires_render = false;
		const animation_frames = this.animation_fps.get_frames_due();
		if (animation_frames > 0 && this.screen != null) {
			requires_render = true;
			for (let i = 0; i < animation_frames; i++) {
				// update animation heirachy and fire off on-complete events once done
				const on_completes = [];
				this.screen.root_view.update_animated_clips(this.animation_fps.delta, (callback) => {
					on_completes.push(callback);
				});
				for (const callback of on_completes) {
					callback();
				}
			}
		}

		// top level frame dispatch outside of all scenes and context
		this.frame_dispatch.update();

		// top level ui context dispatch include deferred events
		this.context.get_active().update();

		// logical update frames
		const update_frames = this.fps.get_frames_due();
		if (update_frames > 0 && this.current_scene != null) {
			requires_render = true;
			for (let f = 0; f < update_frames; f++) {
				if (this.current_scene != null) {
					this.current_scene.update();
				}
			}
		}

		// if any of the above means we need to re-render the canvas then do it here
		if (requires_render && this.screen != null) {
			this.screen.render();
		}
	}

	set_frame_rate (new_fps, new_animation_fps, min_frames, max_frames, reset) {
		if (!new_animation_fps) {
			new_animation_fps = new_fps;
		}
		this.fps.set_fps(new_fps, min_frames, max_frames, reset);
		this.animation_fps.set_fps(new_animation_fps, min_frames, max_frames, reset);
	}

	pause () {
		this.render_callback.stop();
	}

	resume () {
		this.render_callback.start(() => {
			this.update();
		});
	}

	set_scene (scene) {
		if (this.current_scene != null) {
			this.current_scene.dispose();
			this.current_scene = null;
		}

		this.context.reset();

		if (scene) {
			this.current_scene = scene;
			this.current_scene.app = this;
			this.current_scene.screen = this.screen;
			this.current_scene.context = this.context;

			this.current_scene.prepare();
			if (this.screen != null) {
				this.screen.root_view.add(scene.view);
			}
			this.current_scene.begin();
		}

		this.fps.reset();
		this.animation_fps.reset();
	}

}

function launch_app (canvas, width, height, fit) {
	// create a screen object to map to the canvase if there is one
	const screen = (canvas != null) ? new ui.canvas_screen(canvas, width, height, fit) : null;

	// create an launch the app with an empty scene
	const app_instance = new app(screen);
	app_instance.set_scene(new app_node());
	app_instance.resume();
	return app_instance;
}

export { geometry, dispatch, coroutine, state, resource, display, ui, tween, app_node, launch_app };
*/