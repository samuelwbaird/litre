// make use of DOM elements for litre apps
// copyright 2022 Samuel Baird MIT Licence

// associate part of the DOM with app_nodes
// intern and re-use parts of the DOM as templates
// any useful support needed for traversing DOM elements
// logical sizing of DOM elements and co-ordinates
// touch and gesture handling


function make_absolute (element) {
	if (element.style.position != 'absolute') {
		const bounds = element.getBoundingClientRect();
		element.style.position = 'absolute';
		element.style.top = bounds.top;
		element.style.left = bounds.left;
	}
	return element;
}

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

export { screen };