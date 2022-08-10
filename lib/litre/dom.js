// make use of DOM elements for litre apps
// copyright 2022 Samuel Baird MIT Licence

// associate part of the DOM with app_nodes
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

function make_absolute (element, left = null, top = null) {
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

// update settings within an element tree as a sort of template spec
// supported update specs,
// array of arrays, with the inner arrays being of 3 parts, selecter, field and new value
// [ ['selecter', 'field', new_value], ['selecter', 'field', new_value] ]
function update (element, update_spec) {
	element = node(element);

	if (Array.isArray(update_spec)) {
		for (const update of update_spec) {
			if (Array.isArray(update) && update.length == 3) {
				const target = node(update[0], element);
				target[update[1]] = update[2];
			}
		}
	}
}

// clone and element and optionally apply a template style update
function clone (element, update_spec) {
	element = node(element);
	// cloning from a template tag is a good use case but needs special treatement
	const clone = (element.tagName == 'TEMPLATE') ? element.content.firstElementChild.cloneNode(true) : element.cloneNode(true);
	delete clone.id;
	if (update_spec != null) {
		update(clone, update_spec);
	}
	return clone;
}

// treat a dom element as a logically sized x/y screen
class screen {

	constructor (element, parent_to) {
		// configure the element to work as a screen
		this.element = make_absolute(element);
		this.element.style.padding = 0;
		this.element.style.overflow = 'hidden';
		this.element.style['transform-origin'] = 'top left';

		// optionally match the screen size to another element
		// or if null to the window by default
		this.parent_to = parent_to;
	}

	scale_to_fit (width, height) {
		this.target_width = width;
		this.target_height = height;
		this.update();
	}

	update () {
		const bounds = (this.parent_to ? this.parent_to.getBoundingClientRect() : {
			top: 0,
			left: 0,
			width: window.innerWidth,
			height: window.innerHeight,
		});

		if (bounds.width == this.dom_width && bounds.height == this.dom_height) {
			return;
		}

		this.dom_width = bounds.width;
		this.dom_height = bounds.height;

		const scale_x = this.dom_width / this.target_width;
		const scale_y = this.dom_height / this.target_height;
		this.scale = Math.min(scale_x, scale_y);

		this.width = Math.round(this.dom_width / this.scale);
		this.height = Math.round(this.dom_height / this.scale);

		this.element.style.scale = this.scale;
		this.element.style.top = 0;
		this.element.style.left = 0;
		this.element.style.width = this.width;
		this.element.style.height = this.height;

		console.log('screen: dom(' + this.dom_width + ', ' + this.dom_height + ') logical(' + this.width + ', ' + this.height + ') scale: ' + this.scale);
	}

}

function transparent_wrap (wrap, element) {
	const proxied_methods = new Map();

	return new Proxy(element, {
		get (obj, prop) {
			if (proxied_methods.has(prop)) {
				return proxied_methods.get(prop);
			}
			if (prop in wrap) {
				const value = wrap[prop];
				if (value instanceof Function) {
					proxied_methods.set(prop, (...args) => {
						return value.apply(wrap, args);
					});
					return proxied_methods.get(prop);
				} else {
					return value;
				}
			} else {
				const value = element[prop];
				if (value instanceof Function) {
					proxied_methods.set(prop, (...args) => {
						return value.apply(element, args);
					});
					return proxied_methods.get(prop);
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

class wrap {

	constructor (app_node, element) {
		this.app_node = app_node;
		this.element = node(element);
		this.listeners = [];

		// not sure if this is a good idea, but this returns an object that transparently
		// behaves as the wrap first, and the element second
		// return transparent_wrap(this, this.element);
	}

	node (element) {
		// find and wrap elements relatively
		return this.app_node.wrap(node(element, this.element));
	}

	all (selector) {
		// return all matching elements wrapped
		const nodes = this.element.querySelectorAll(selector);
		for (let i = 0; i < nodes.lenth; i++) {
			nodes[i] = this.app_node.wrap(nodes[i]);
		}
		return nodes;
	}

	make_absolute () {
		make_absolute(this.element);
		return this;
	}

	position (left, top) {
		make_absolute(this.element, left, top);
		return this;
	}

	listen (event, callback) {
		this.element.addEventListener(event, callback);
		this.listeners.push({
			event: event,
			callback: callback,
		});
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

	show (hide_on_dispose) {
		this.element.style.display = null;
		if (hide_on_dispose) {
			this.add_disposable(() => {
				this.element.style.display = 'none';
			});
		}
		return this;
	}

	hide (show_on_dispose) {
		const restore = this.element.style.display;
		this.element.style.display = 'none';
		if (show_on_dispose) {
			this.add_disposable(() => {
				this.element.style.display = restore;
			});
		}
		return this;
	}

	add (html_tag, attributes = null, remove_on_dispose = true) {
		const child = document.createElement(html_tag, attributes);
		this.element.appendChild(child);
		if (remove_on_dispose) {
			this.add_disposable(() => {
				if (child.parentNode) {
					child.parentNode.removeChild(child);
				}
			});
		}
		return this.app_node.wrap(child);
	}

	remove () {
		if (this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}
	}

	clone (template, update_specs = null, remove_on_dispose = true) {
		// clone from outside of this parent
		const cloned_element = clone(template, update_specs);
		this.element.appendChild(cloned_element);
		if (remove_on_dispose) {
			this.add_disposable(() => {
				if (cloned_element.parentNode) {
					cloned_element.parentNode.removeChild(cloned_element);
				}
			});
		}
		return this.app_node.wrap(cloned_element);
	}

	add_disposable (disposable) {
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
		this.app_node = null;
	}

}


export { node, make_absolute, update, clone, screen, wrap, transparent_wrap };