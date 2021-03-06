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
	}

	return element;
}

function make_absolute (element) {
	element = node(element);

	if (element.style.position != 'absolute') {
		const bounds = element.getBoundingClientRect();
		element.style.position = 'absolute';
		element.style.top = bounds.top;
		element.style.left = bounds.left;
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
				const target = node(update[0], element)
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
	clone.id = null;
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


class dom_link {

	constructor (app_node, dom_parent) {
		this.app_node = app_node;
		this.dom_parent = dom_parent;
		this.listeners = [];
	}

	node (element) {
		if (!element) {
			return this.dom_parent;
		}
				
		return node(element, this.dom_parent);
	}
	
	all (selector) {
		return this.dom_parent.querySelectorAll(selector);
	}

	make_absolute (element) {
		return make_absolute(this.node(element));
	}

	listen (target, event, callback) {
		target = this.node(target);
		target.addEventListener(event, callback);
		
		this.listeners.push({
			target: target,
			event: event,
			callback: callback,
		});
	}

	unlisten (target, event) {
		target = this.node(target);
		
		let i = 0;
		while (i < this.listeners.length) {
			const l = this.listeners[i];
			if (l.target == target && !event || l.event == event) {
				l.target.removeEventListener(l.event, l.callback);
				this.listeners.splice(i, 1);
			} else {
				i++;
			}
		}
	}

	show (element, hide_on_dispose = true) {
		element = this.node(element);		
		element.style.display = null;
		if (hide_on_dispose) {
			this.app_node.add_disposable(() => {
				element.style.display = 'none';
			});
		}
	}

	hide (element, show_on_dispose = true) {
		element = this.node(element);		
		let restore = element.style.display;
		element.style.display = 'none';
		if (show_on_dispose) {
			this.app_node.add_disposable(() => {
				element.style.display = restore;
			});
		}
	}

	clone (element, update_specs, remove_on_dispose = true) {
		// clone from outside of this parent
		// add to this parent
		// make visible if not visible
		// apply update specs
	}

	dispose () {
		for (const l of this.listeners) {
			l.target.removeEventListener(l.event, l.callback);			
		}
		this.listeners = null;
		this.dom_parent = null;
		this.app_node = null;
	}

}


export { node, make_absolute, update, clone, screen, dom_link };