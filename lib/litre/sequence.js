// sequencing, a list for update during iteration, delayed dispatch, tweening an coroutine
// copyright 2022 Samuel Baird MIT Licence


// ----------------------------------------------------------------------
// -- update list -------------------------------------------------------
// ----------------------------------------------------------------------
//
// collection with tag/callback/expire behaviour

class UpdateList {
	constructor () {
		this.list = [];

		// control updates during iteration
		this.isIterating = false;
		this.iterationIndex = 0;

		// these are only create if an interruption to fast path occurs
		this.slowPathToComplete = null;
		this.slowPathToIgnore = null;
	}

	add (obj, tag) {
		// capture the slow path here before objects are added this update cycle
		this.enableSlowPathIterationIfRequired();

		this.list.push({
			obj: obj,
			tag: tag,
		});
	}

	remove (objOrTag) {
		// cancel the fast path if we're in an iteration
		this.enableSlowPathIterationIfRequired();

		let didRemove = false;
		let i = 0;
		while (i < this.list.length) {
			const entry = this.list[i];
			if (entry.obj == objOrTag || entry.tag == objOrTag) {
				this.list.splice(i, 1);
				didRemove = true;
			} else {
				i++;
			}
		}

		return didRemove;
	}

	clear () {
		// cancel the fast path if we're in an iteration
		this.enableSlowPathIterationIfRequired();

		// clear our actual list
		this.list = [];
	}

	isClear () {
		return this.list.length == 0;
	}

	first () {
		return this.list[0].obj;
	}

	last () {
		return this.list[this.list.length - 1].obj;
	}

	update (updateFunction, removeONReturnTrue) {
		// if we're already in an iteration, don't allow it to recurse
		if (this.isIterating) {
			return;
		}

		// markers to begin the iteration in fast path
		this.isIterating = true;

		// begin on a fast path, iterating by index and removing complete updates as required
		// avoid creation of temporary objects unless update during iteration requires it
		let i = 0;
		let length = this.list.length;
		while (i < length && this.slowPathToComplete == null) {
			// save this marker in case we drop off the fast path
			this.iterationIndex = i;

			// check this entry, update and remove if required
			const entry = this.list[i];
			if (updateFunction(entry.obj) === true && removeONReturnTrue) {
				// if we've jumped onto the slow path during the update then be careful here
				if (this.slowPathToComplete != null) {
					const postUpdateIndex = this.list.indexOf(entry);
					if (postUpdateIndex >= 0) {
						this.list.splice(postUpdateIndex, 1);
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
		if (this.slowPathToComplete != null) {
			// complete all that haven't been removed since we started the slow path
			for (const entry of this.slowPathToComplete) {
				// first check this entry is still in the real list
				const currentIndex = this.list.indexOf(entry);
				if (currentIndex >= 0) {
					if (updateFunction(entry.obj) === true && removeONReturnTrue) {
						// find and remove it from the original list, if its still in after the update function
						const postUpdateIndex = this.list.indexOf(entry);
						if (postUpdateIndex >= 0) {
							this.list.splice(postUpdateIndex, 1);
						}
					}
				}
			}
		}

		// clear flags and data that can be accumulated during iteration
		this.slowPathToComplete = null;
		this.isIterating = false;
	}

	enableSlowPathIterationIfRequired () {
		// only do this if we haven't already for this iteration
		if (!this.isIterating || this.slowPathToComplete != null) {
			return;
		}

		// capture a copy of everything we need to complete on the remainder of the fast path
		this.slowPathToComplete = [];
		for (let i = this.iterationIndex + 1; i < this.list.length; i++) {
			this.slowPathToComplete.push(this.list[i]);
		}
	}

	cloneUpdate (updateFunction, removeONReturnTrue) {
		const clone = this.list.concat();
		for (const entry of clone) {
			if (updateFunction(entry.obj) === true && removeONReturnTrue) {
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
const frameDispatchUpdateFunction = function (entry) {
	if (entry.repeatFn) {
		entry.repeatFn();
	}
	if (entry.count && entry.count > 0) {
		if (--entry.count == 0) {
			if (entry.delayFn) {
				entry.delayFn();
			}
			// finished now
			return true;
		}
	}
	return false;
};

class FrameDispatch {

	constructor () {
		this.updateList = new UpdateList();
	}

	// do this after a delay
	delay (count, fn, tag) {
		count = Math.floor(count);
		if (count <= 0) {
			count = 1;
		}

		this.updateList.add({
			type : 'delay',
			count : count,
			delayFn : fn,
		}, tag);
	}

	// repeat this a number of times
	recur (count, fn, tag) {
		count = Math.floor(count);
		if (count <= 0) {
			return;
		}

		this.updateList.add({
			type : 'recur',
			count : count,
			repeatFn : fn,
		}, tag);
	}

	// call this every time
	hook (fn, tag) {
		this.updateList.add({
			type : 'recur',
			count : -1,		// infinite repeat
			repeatFn : fn,
		}, tag);
	}

	// call this once only
	once (fn, tag) {
		this.recur(1, fn, tag);
	}

	update () {
		this.updateList.update(frameDispatchUpdateFunction, true);
	}

	// proxy through some methods from the updateList
	clear () {
		this.updateList.clear();
	}

	isClear () {
		return this.updateList.isClear();
	}

	remove (tagOrFn) {
		this.updateList.remove(tagOrFn);
	}

	dispose () {
		this.clear();
	}
}

export { UpdateList, FrameDispatch };

// ----------------------------------------------------------------------
// -- tweening ----------------------------------------------------------
// ----------------------------------------------------------------------
//
// fixed framerate easing from 0 to 1
//

class Easing {

	static fromFormula (frames, formula) {
		const out = [];
		const scale = 1 / frames;
		for (let i = 1; i <= frames; i++) {
			const ratio = i * scale;
			out.push(formula(ratio));
		}
		return out;
	}

	static linear (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			return ratio;
		});
	}

	static easeIn (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			return ratio * ratio;
		});
	}

	static easeOut (frames) {
		return Easing.fromFormula(frames, (ratio) => {
			return 1 - (1 - ratio) * (1 - ratio);
		});
	}

	static easeInout (frames) {
		return Easing.fromFormula(frames, (ratio) => {
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

function captureTweenProperty (target, property, final) {
	// capture if this property has a non-numeric suffix (eg. 90px or 10%)
	let initial = target[property];
	let suffix = 0;
	if (typeof initial == 'string') {
		const numeric = initial.match(/^[\d\.\-]+/);
		if (numeric) {
			suffix = initial.substring(numeric[0].length) ?? '';
			initial = parseFloat(numeric[0]);
		}
	}
	return { initial : initial, final : final, suffix: suffix };
}

class Tween {
	constructor (target, easing, properties, optionalParams) {
		this.target = target;
		this.easing = easing;
		// backwards compatibility, if optionalParams is a function, it is the onComplete
		if (typeof optionalParams == 'function') {
			this.onComplete = optionalParams;
		} else if (optionalParams) {
			this.onComplete = optionalParams.onComplete;
			this.delay = optionalParams.delay;
		}

		// gather start and end values for all tweened properties
		this.properties = {};
		for (const k in properties) {
			this.properties[k] = captureTweenProperty(target, k, properties[k]);
		}

		this.frame = 0;
	}

	update () {
		if (this.delay && this.delay > 0) {
			this.delay--;
			if (this.delay == 0) {
				// re-capture starting values after the delay if one applies
				for (const k in this.properties) {
					this.properties[k] = captureTweenProperty(this.target, k, this.properties[k].final);
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
				const onComplete = this.onComplete;
				this.onComplete = null;
				if (onComplete) {
					onComplete();
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
		const onComplete = this.onComplete;
		this.onComplete = null;
		if (onComplete) {
			onComplete();
		}
		return true;
	}
}

class TweenManager {

	constructor () {
		this.tweens = new UpdateList();
	}

	add (tween) {
		this.tweens.add(tween, tween.target);
	}

	removeTweensOf (target) {
		this.tweens.remove(target);
	}

	update () {
		this.tweens.update((tween) => {
			tween.update();
		});
	}

	completeAll () {
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

export { Easing, Tween, TweenManager };

// ----------------------------------------------------------
// -- coroutines --------------------------------------------
// ----------------------------------------------------------
//
// using JS generator methods
//

const yieldCancel = {};

class Coroutine {
	constructor (generator, applyThis, ...args) {
		this.generator = generator.apply(applyThis, args);
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
			if (result.done || this.yield == yieldCancel) {
				this.complete = true;
				return true;
			}
		}
	}
}

class CoroutineManager {
	constructor () {
		this.updateList = new UpdateList();
	}

	run (generator, applyThis, ...args) {
		this.updateList.add(new Coroutine(generator, applyThis, ...args));
	}

	update () {
		// this.updateList.cloneUpdate((c) => {
		this.updateList.update((c) => {
			return c.update();
		}, true);
	}

	clear () {
		this.updateList.clear();
	}

	isClear () {
		return this.updateList.isClear();
	}

	remove (tagOrFn) {
		this.updateList.remove(tagOrFn);
	}

	dispose () {
		this.clear();
	}
}

function yieldFrame () {
	return function () {
		return true;
	};
}

function yieldFrames (frames) {
	let f = frames;
	return function () {
		f--;
		return f <= 0;
	};
}

function yieldTween (tween) {
	return function () {
		return tween.frame >= tween.easing.length;
	};
}

function yieldCondition (condition) {
	return condition;
}

function yieldCoroutine (generator, applyThis) {
	const co = coroutine(generator, applyThis);
	return function () {
		return co.update();
	};
}

export { CoroutineManager, Coroutine, yieldCancel, yieldFrame, yieldFrames, yieldTween, yieldCondition, yieldCoroutine };
