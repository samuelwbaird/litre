// make use of DOM elements for litre apps
// copyright 2022 Samuel Baird MIT Licence

// associate part of the DOM with appNodes
// intern and re-use parts of the DOM as templates
// any useful support needed for traversing DOM elements
// logical sizing of DOM elements and co-ordinates
// touch and gesture handling

function node (element, parent) {
	if (typeof element == 'string') {
		parent = parent ?? document;
		if (element == '') {
			return parent;
		}
		if (parent == document) {
			const byID = document.getElementById(element);
			if (byID) {
				return byID;
			}
		}

		// allow array notation to index into multiple selector matches
		const split = element.match(/^(.*)\[(.*)\]$/i);
		if (split) {
			return parent.querySelectorAll(split[1])[parseInt(split[2])];
		} else {
			return parent.querySelector(element);
		}
	} else if (element && element.element) {
		// unwrap wrapped elements
		return element.element;
	}

	return element;
}

function makeAbsolute (element, left = null, top = null) {
	element = node(element);

	if (element.style.position != 'absolute') {
		const bounds = element.getBoundingClientRect();
		element.style.position = 'absolute';
		element.style.top = bounds.top;
		element.style.left = bounds.left;
	}

	if (left) {
		element.style.left = left;
	}
	if (top) {
		element.style.top = top;
	}

	return element;
}

function clear (element) {
	element = node(element);
	element.replaceChildren();
}

// update settings within an element tree as a sort of template spec
// supported update specs,
// array of arrays, with the inner arrays being of 3 parts, selecter, field and new value
// [ ['selecter', 'field', newValue], ['selecter', 'field', newValue] ]
function update (element, updateSpec) {
	element = node(element);

	if (Array.isArray(updateSpec)) {
		for (const update of updateSpec) {
			if (Array.isArray(update) && update.length == 3) {
				const target = node(update[0], element);
				target[update[1]] = update[2];
			} else if (Array.isArray(update) && update.length == 4) {
				const target = node(update[0], element);
				target[update[1]][update[2]] = update[3];
			}
		}
	}
}

// clone and element and optionally apply a template style update
function clone (element, updateSpec) {
	element = node(element);
	// cloning from a template tag is a good use case but needs special treatement
	const clone = (element.tagName == 'TEMPLATE') ? element.content.firstElementChild.cloneNode(true) : element.cloneNode(true);
	delete clone.id;
	if (updateSpec != null) {
		update(clone, updateSpec);
	}
	return clone;
}

// treat a dom element as a logically sized x/y screen
class Screen {

	constructor (element, parentTo) {
		// configure the element to work as a screen
		this.element = makeAbsolute(element);
		this.element.style.padding = 0;
		this.element.style.overflow = 'hidden';
		this.element.style['transform-origin'] = 'top left';

		// optionally match the screen size to another element
		// or if null to the window by default
		this.parentTo = parentTo;
	}

	scaleToFit (width, height) {
		this.targetWidth = width;
		this.targetHeight = height;
		this.update();
	}

	update () {
		const bounds = (this.parentTo ? this.parentTo.getBoundingClientRect() : {
			top: 0,
			left: 0,
			width: window.innerWidth,
			height: window.innerHeight,
		});

		if (bounds.width == this.domWidth && bounds.height == this.domHeight) {
			return;
		}

		this.domWidth = bounds.width;
		this.domHeight = bounds.height;

		const scaleX = this.domWidth / this.targetWidth;
		const scaleY = this.domHeight / this.targetHeight;
		this.scale = Math.min(scaleX, scaleY);

		this.width = Math.round(this.domWidth / this.scale);
		this.height = Math.round(this.domHeight / this.scale);

		this.element.style.scale = this.scale;
		this.element.style.top = 0;
		this.element.style.left = 0;
		this.element.style.width = this.width;
		this.element.style.height = this.height;

		console.log('screen: dom(' + this.domWidth + ', ' + this.domHeight + ') logical(' + this.width + ', ' + this.height + ') scale: ' + this.scale);
	}

}

export let enableTransparentWrap = true;

function transparentWrap (wrap, element) {
	const proxiedMethods = new Map();

	return new Proxy(element, {
		get (obj, prop) {
			if (proxiedMethods.has(prop)) {
				return proxiedMethods.get(prop);
			}
			if (prop in wrap) {
				const value = wrap[prop];
				if (value instanceof Function) {
					proxiedMethods.set(prop, (...args) => {
						return value.apply(wrap, args);
					});
					return proxiedMethods.get(prop);
				} else {
					return value;
				}
			} else {
				const value = element[prop];
				if (value instanceof Function) {
					proxiedMethods.set(prop, (...args) => {
						return value.apply(element, args);
					});
					return proxiedMethods.get(prop);
				} else {
					return value;
				}
			}
		},
		set (obj, prop, newval) {
			if (prop in wrap) {
				wrap[prop] = newval;
			} else {
				element[prop] = newval;
			}
			return true;
		},
	});
}

class Wrap {

	constructor (appNode, element) {
		this.appNode = appNode;
		this.element = node(element);
		this.listeners = [];

		// not sure if this is a good idea, but this returns an object that transparently
		// behaves as the wrap first, and the element second
		if (enableTransparentWrap) {
			return transparentWrap(this, this.element);
		}
	}

	wrap (element) {
		// find and wrap elements relatively
		return this.appNode.wrap(node(element, this.element));
	}

	find (element) {
		return node(element, this.element);
	}

	all (selector) {
		// return all matching elements wrapped
		const nodes = this.element.querySelectorAll(selector);
		const wrapped = [];
		for (let i = 0; i < nodes.length; i++) {
			wrapped[i] = this.appNode.wrap(nodes[i]);
		}
		return wrapped;
	}

	makeAbsolute () {
		makeAbsolute(this.element);
		return this;
	}

	position (left, top) {
		makeAbsolute(this.element, left, top);
		return this;
	}

	listen (event, callback) {
		if (Array.isArray(event)) {
			for (const e of event) {
				this.listen(e, callback);
			}
		} else {
			this.element.addEventListener(event, callback);
			this.listeners.push({
				event: event,
				callback: callback,
			});
		}
		return this;
	}

	unlisten (event) {
		let i = 0;
		while (i < this.listeners.length) {
			const l = this.listeners[i];
			if (!event || l.event == event) {
				this.element.removeEventListener(l.event, l.callback);
				this.listeners.splice(i, 1);
			} else {
				i++;
			}
		}
		return this;
	}

	touchArea (onTouchBegin, onTouchMove, onTouchEnd, onTouchCancel) {
		const touchArea = {
			isTouched: false,
			onTouchBegin: onTouchBegin,
			onTouchMove: onTouchMove,
			onTouchEnd: onTouchEnd,
			onTouchCancel: onTouchCancel,
			x: 0,
			y: 0,
			id: 0,
			time: 0,
			startX: 0,
			startY: 0,
			startTime: 0,
		};

		const checkID = (evt) => {
			if (evt.changedTouches) {
				return evt.changedTouches[0].identifier;
			} else {
				return 1;
			}
		};

		const setCoords = (evt) => {
			const bounds = this.element.getBoundingClientRect();
			if (evt.changedTouches) {
				touchArea.x = evt.changedTouches[0].pageX - bounds.left;
				touchArea.y = evt.changedTouches[0].pageY - bounds.top;
			} else {
				touchArea.x = evt.pageX - bounds.left;
				touchArea.y = evt.pageY - bounds.top;
			}
			touchArea.time = Date.now();
		};

		// mouse and touch down on this DOM object to capture touches
		this.listen(['mousedown', 'touchstart'], (evt) => {
			if (touchArea.isTouched) {
				return false;
			}
			setCoords(evt);
			touchArea.isTouched = true;
			touchArea.id = checkID(evt);
			touchArea.startX = touchArea.x;
			touchArea.startY = touchArea.y;
			touchArea.startTime = touchArea.time;
			touchArea.onTouchBegin?.(touchArea);
		});
		this.listen(['mousemove', 'touchmove'], (evt) => {
			if (!touchArea.isTouched || checkID(evt) != touchArea.id) { return; }
			setCoords(evt);
			touchArea.onTouchMove?.(touchArea);
		});

		// but track all other events on window
		const w = this.wrap(window);
		w.listen(['mouseup', 'touchend'], (evt) => {
			if (!touchArea.isTouched || checkID(evt) != touchArea.id) { return; }
			evt.preventDefault();
			touchArea.onTouchEnd?.(touchArea);
			touchArea.isTouched = false;
		});
		w.listen(['contextmenu', 'touchcancel'], (evt) => {
			if (!touchArea.isTouched || checkID(evt) != touchArea.id) { return; }
			evt.preventDefault();
			touchArea.isTouched = false;
			if (touchArea.onTouchCancel) {
				touchArea.onTouchCancel(touchArea);
			} else {
				touchArea.onTouchEnd?.(touchArea);
			}
		});

		return touchArea;
	}

	show (hideONDispose) {
		this.element.style.display = null;
		if (hideONDispose) {
			this.addDisposable(() => {
				this.element.style.display = 'none';
			});
		}
		return this;
	}

	hide (showONDispose) {
		const restore = this.element.style.display;
		this.element.style.display = 'none';
		if (showONDispose) {
			this.addDisposable(() => {
				this.element.style.display = restore;
			});
		}
		return this;
	}

	add (htmlTag, attributes = null, removeONDispose = true) {
		const child = document.createElement(htmlTag);
		if (attributes) {
			for (const key in attributes) {
				if (key == 'style') {
					for (const skey in attributes[key]) {
						child.style[skey] = attributes[key][skey];
					}
				} else {
					child[key] = attributes[key];
				}
			}
		}
		this.element.appendChild(child);
		if (removeONDispose) {
			this.addDisposable(() => {
				if (child.parentNode) {
					child.parentNode.removeChild(child);
				}
			});
		}
		return this.appNode.wrap(child);
	}

	remove () {
		if (this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}
	}

	clear () {
		clear(this.element);
	}

	clone (template, updateSpecs = null, removeONDispose = true) {
		// clone from outside of this parent
		const clonedElement = clone(template, updateSpecs);
		this.element.appendChild(clonedElement);
		if (removeONDispose) {
			this.addDisposable(() => {
				if (clonedElement.parentNode) {
					clonedElement.parentNode.removeChild(clonedElement);
				}
			});
		}
		return this.appNode.wrap(clonedElement);
	}

	update (updateSpecs) {
		update(this.element, updateSpecs);
	}

	addDisposable (disposable) {
		if (!this.disposables) {
			this.disposables = [];
		}
		this.disposables.push(disposable);
		return disposable;
	}

	dispose () {
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

		for (const l of this.listeners) {
			this.element.removeEventListener(l.event, l.callback);
		}
		this.listeners = null;

		this.element = null;
		this.appNode = null;
	}

}

// maintain a list of templated child elements, created and updated from
// a list of data elements
class TemplateList {

	constructor (parent, template, updateFunction) {
		this.parent = parent;
		this.template = template;
		this.updateFunction = updateFunction;

		this.entriesByID = new Map();
	}

	updateList (list) {
		const unused = new Map();
		for (const [id, entry] of this.entriesByID) {
			unused.set(id, entry);
		}

		let order = 0;
		for (const entry of (list ?? [])) {
			// update existing
			if (this.entriesByID.has(entry.id)) {
				const dom = this.entriesByID.get(entry.id);
				unused.delete(entry.id);
				dom.element.style.order = ++order;
				this.updateFunction(entry, dom);

			} else {
				// create new
				const dom = this.parent.clone(this.template);
				this.entriesByID.set(entry.id, dom);
				dom.element.style.order = ++order;
				this.updateFunction(entry, dom);
			}
		}

		// remove unused
		for (const [id, dom] of unused) {
			this.entriesByID.delete(id);
			dom.remove();
		}
	}

}

export { node, makeAbsolute, update, clone, Screen, Wrap, transparentWrap, TemplateList };
