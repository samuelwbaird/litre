// sequencing, a list for update during iteration, delayed dispatch, tweening an coroutine
// copyright 2022 Samuel Baird MIT Licence


// ----------------------------------------------------------------------
// -- update list -------------------------------------------------------
// ----------------------------------------------------------------------
//
// collection with tag/callback/expire behaviour

class update_list {
	constructor () {
		this.list = [];

		// control updates during iteration
		this.is_iterating = false;
		this.iteration_index = 0;

		// these are only create if an interruption to fast path occurs
		this.slow_path_to_complete = null;
		this.slow_path_to_ignore = null;
	}

	add (obj, tag) {
		// capture the slow path here before objects are added this update cycle
		this.enable_slow_path_iteration_if_required();

		this.list.push({
			obj: obj,
			tag: tag,
		});
	}

	remove (obj_or_tag) {
		// cancel the fast path if we're in an iteration
		this.enable_slow_path_iteration_if_required();

		let did_remove = false;
		let i = 0;
		while (i < this.list.length) {
			const entry = this.list[i];
			if (entry.obj == obj_or_tag || entry.tag == obj_or_tag) {
				this.list.splice(i, 1);
				did_remove = true;
			} else {
				i++;
			}
		}

		return did_remove;
	}

	clear () {
		// cancel the fast path if we're in an iteration
		this.enable_slow_path_iteration_if_required();

		// clear our actual list
		this.list = [];
	}

	is_clear () {
		return this.list.length == 0;
	}

	first () {
		return this.list[0].obj;
	}

	last () {
		return this.list[this.list.length - 1].obj;
	}

	update (update_function, remove_on_return_true) {
		// if we're already in an iteration, don't allow it to recurse
		if (this.is_iterating) {
			return;
		}

		// markers to begin the iteration in fast path
		this.is_iterating = true;

		// begin on a fast path, iterating by index and removing complete updates as required
		// avoid creation of temporary objects unless update during iteration requires it
		let i = 0;
		let length = this.list.length;
		while (i < length && this.slow_path_to_complete == null) {
			// save this marker in case we drop off the fast path
			this.iteration_index = i;

			// check this entry, update and remove if required
			const entry = this.list[i];
			if (update_function(entry.obj) === true && remove_on_return_true) {
				// if we've jumped onto the slow path during the update then be careful here
				if (this.slow_path_to_complete != null) {
					const post_update_index = this.list.indexOf(entry);
					if (post_update_index >= 0) {
						this.list.splice(post_update_index, 1);
					}
				} else {
					this.list.splice(i, 1);
					length--;
				}
			} else {
				i++;
			}
		}

		// if we've dropped off the fast path then complete the iteration on the slow path
		if (this.slow_path_to_complete != null) {
			// complete all that haven't been removed since we started the slow path
			for (const entry of this.slow_path_to_complete) {
				// first check this entry is still in the real list
				const current_index = this.list.indexOf(entry);
				if (current_index >= 0) {
					if (update_function(entry.obj) === true && remove_on_return_true) {
						// find and remove it from the original list, if its still in after the update function
						const post_update_index = this.list.indexOf(entry);
						if (post_update_index >= 0) {
							this.list.splice(post_update_index, 1);
						}
					}
				}
			}
		}

		// clear flags and data that can be accumulated during iteration
		this.slow_path_to_complete = null;
		this.is_iterating = false;
	}

	enable_slow_path_iteration_if_required () {
		// only do this if we haven't already for this iteration
		if (!this.is_iterating || this.slow_path_to_complete != null) {
			return;
		}

		// capture a copy of everything we need to complete on the remainder of the fast path
		this.slow_path_to_complete = [];
		for (let i = this.iteration_index + 1; i < this.list.length; i++) {
			this.slow_path_to_complete.push(this.list[i]);
		}
	}

	clone_update (update_function, remove_on_return_true) {
		const clone = this.list.concat();
		for (const entry of clone) {
			if (update_function(entry.obj) === true && remove_on_return_true) {
				const index = this.list.indexOf(entry);
				if (index > -1) {
					this.list.splice(index, 1);
				}
			}
		}
	}
}

// ----------------------------------------------------------------------
// -- frame dispatch ----------------------------------------------------
// ----------------------------------------------------------------------
//
// attach functions to delay or repeat around a frame timer

// how to handle dispatching each entry
const frame_dispatch_update_function = function (entry) {
	if (entry.repeat_fn) {
		entry.repeat_fn();
	}
	if (entry.count && entry.count > 0) {
		if (--entry.count == 0) {
			if (entry.delay_fn) {
				entry.delay_fn();
			}
			// finished now
			return true;
		}
	}
	return false;
};

class frame_dispatch {

	constructor () {
		this.update_list = new update_list();
	}

	// do this after a delay
	delay (count, fn, tag) {
		count = Math.floor(count);
		if (count <= 0) {
			count = 1;
		}

		this.update_list.add({
			type : 'delay',
			count : count,
			delay_fn : fn,
		}, tag);
	}

	// repeat this a number of times
	recur (count, fn, tag) {
		count = Math.floor(count);
		if (count <= 0) {
			return;
		}

		this.update_list.add({
			type : 'recur',
			count : count,
			repeat_fn : fn,
		}, tag);
	}

	// call this every time
	hook (fn, tag) {
		this.update_list.add({
			type : 'recur',
			count : -1,		// infinite repeat
			repeat_fn : fn,
		}, tag);
	}

	// call this once only
	once (fn, tag) {
		this.recur(1, fn, tag);
	}

	update () {
		this.update_list.update(frame_dispatch_update_function, true);
	}

	// proxy through some methods from the update_list
	clear () {
		this.update_list.clear();
	}

	is_clear () {
		return this.update_list.is_clear();
	}

	remove (tag_or_fn) {
		this.update_list.remove(tag_or_fn);
	}

	dispose () {
		this.clear();
	}
}

export { update_list, frame_dispatch };

// ----------------------------------------------------------------------
// -- tweening ----------------------------------------------------------
// ----------------------------------------------------------------------
//
// fixed framerate easing from 0 to 1
//

class easing {

	static from_formula (frames, formula) {
		const out = [];
		const scale = 1 / frames;
		for (let i = 1; i <= frames; i++) {
			const ratio = i * scale;
			out.push(formula(ratio));
		}
		return out;
	}

	static linear (frames) {
		return easing.from_formula(frames, (ratio) => {
			return ratio;
		});
	}

	static ease_in (frames) {
		return easing.from_formula(frames, (ratio) => {
			return ratio * ratio;
		});
	}

	static ease_out (frames) {
		return easing.from_formula(frames, (ratio) => {
			return 1 - (1 - ratio) * (1 - ratio);
		});
	}

	static ease_inout (frames) {
		return easing.from_formula(frames, (ratio) => {
			ratio = ratio * 2;
			if (ratio < 1) {
				return ratio * ratio * 0.5;
			} else {
				ratio = 1 - (ratio - 1);
				return 0.5 + (1 - (ratio * ratio)) * 0.5;
			}
		});
	}

	static interpolate (values, frames) {
		const scale = (values.length - 1) / frames;
		const out = [];
		for (let i = 0; i < frames; i++) {
			const ratio = (i + 1) * scale;
			const base = Math.floor(ratio);
			const offset = ratio - base;
			if (base < values.length) {
				out[i] = (values[base] * (1 - offset)) + (values[base + 1] * offset);
			} else {
				out[i] = values[values.length - 1];
			}
		}
		// make sure the final value always is an exact match
		out[out.length - 1] = values[values.length - 1];
		return out;
	}

}

function capture_tween_property (target, property, final) {
	// capture if this property has a non-numeric suffix (eg. 90px or 10%)
	let initial = target[property];
	let suffix = 0;
	if (typeof initial == 'string') {
		const numeric = initial.match(/^[\d\.\-]+/)
		if (numeric) {
			suffix = initial.substring(numeric[0].length) ?? '';
			initial = parseFloat(numeric[0]);
		}
	}
	return { initial : initial, final : final, suffix: suffix };	
}

class tween {
	constructor (target, easing, properties, optional_params) {
		this.target = target;
		this.easing = easing;
		// backwards compatibility, if optional_params is a function, it is the on_complete
		if (typeof optional_params == 'function') {
			this.on_complete = optional_params;
		} else if (optional_params) {
			this.on_complete = optional_params.on_complete;
			this.delay = optional_params.delay;
		}

		// gather start and end values for all tweened properties
		this.properties = {};
		for (const k in properties) {
			this.properties[k] = capture_tween_property(target, k, properties[k]);
		}

		this.frame = 0;
	}

	update () {
		if (this.delay && this.delay > 0) {
			this.delay--;
			if (this.delay == 0) {
				// re-capture starting values after the delay if one applies
				for (const k in this.properties) {
					this.properties[k] = capture_tween_property(this.target, k, this.properties[k].final);
				}
			}
			return false;
		}

		if (this.frame < this.easing.length) {
			const ratio = this.easing[this.frame++];
			const inverse = 1 - ratio;

			for (const k in this.properties) {
				const prop = this.properties[k];
				this.target[k] = ((prop.initial * inverse) + (prop.final * ratio)) + prop.suffix;
			}

			// return true if complete
			if (this.frame == this.easing.length) {
				const on_complete = this.on_complete;
				this.on_complete = null;
				if (on_complete) {
					on_complete();
				}
			}
		}

		return this.frame >= this.easing.length;
	}

	complete () {
		const ratio = this.easing[this.easing.length - 1];
		const inverse = 1 - ratio;

		for (const k in this.properties) {
			const prop = this.properties[k];
			this.target[k] = (prop.initial * inverse) + (prop.final * ratio);
		}

		this.frame = this.easing.length;
		const on_complete = this.on_complete;
		this.on_complete = null;
		if (on_complete) {
			on_complete();
		}
		return true;
	}
}

class tween_manager {

	constructor () {
		this.tweens = new update_list();
	}

	add (tween) {
		this.tweens.add(tween, tween.target);
	}

	remove_tweens_of (target) {
		this.tweens.remove(target);
	}

	update () {
		this.tweens.update((tween) => {
			tween.update();
		});
	}

	complete_all () {
		this.tweens.update((tween) => {
			tween.complete();
		});
	}

	clear () {
		this.tweens.clear();
	}

	dispose () {
		this.tweens.clear();
		this.tweens = null;
	}

}

export { easing, tween, tween_manager };

// ----------------------------------------------------------
// -- coroutines --------------------------------------------
// ----------------------------------------------------------
//
// using JS generator methods
//

const yield_cancel = {};

class coroutine {
	constructor (generator, apply_this) {
		if (apply_this) {
			this.generator = generator.apply(apply_this);
		} else {
			this.generator = generator();
		}

		this.yield = null;
		this.complete = false;
	}

	update () {
		if (this.complete) {
			return true;
		}

		// do we have a current yield condition
		if (this.yield) {
			const satisfied = this.yield();
			if (satisfied) {
				this.yield = null;
			}
		}

		if (!this.yield) {
			const result = this.generator.next();
			this.yield = result.value;
			if (result.done || this.yield == yield_cancel) {
				this.complete = true;
				return true;
			}
		}
	}
}

class coroutine_manager {
	constructor (apply_this) {
		this.apply_this = apply_this;
		this.update_list = new update_list();
	}

	run (generator, apply_this) {
		this.update_list.add(new coroutine(generator, (apply_this != null) ? apply_this : this.apply_this));
	}

	update () {
		// this.update_list.clone_update((c) => {
		this.update_list.update((c) => {
			return c.update();
		}, true);
	}

	clear () {
		this.update_list.clear();
	}

	is_clear () {
		return this.update_list.is_clear();
	}

	remove (tag_or_fn) {
		this.update_list.remove(tag_or_fn);
	}

	dispose () {
		this.clear();
	}
}

function yield_frame () {
	return function () {
		return true;
	};
}

function yield_frames (frames) {
	let f = frames;
	return function () {
		f--;
		return f <= 0;
	};
}

function yield_tween (tween) {
	return function () {
		return tween.frame >= tween.easing.length;
	};
}

function yield_condition (condition) {
	return condition;
}

function yield_coroutine (generator, apply_this) {
	const co = coroutine(generator, apply_this);
	return function () {
		return co.update();
	};
}

export { coroutine_manager, coroutine, yield_cancel, yield_frame, yield_frames, yield_tween, yield_condition, yield_coroutine };
