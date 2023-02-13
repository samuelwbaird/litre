// port in a self contained letter-js, a simple canvas 2D display list
// copyright 2022 Samuel Baird MIT Licence

import * as resource from './resource.js';

// ======================================================================================
// basic geometry types to be reused across all other letter modules
// ======================================================================================

// -- point --------------------------------------------------------------------
// basic 2d x,y position

class point {
	constructor (x, y) {
		this.x = x;
		this.y = y;
	}

	length () {
		return Math.sqrt((this.x * this.x) + (this.y * this.y));
	}

	distance (p) {
		const x = (p.x - this.x);
		const y = (p.y - this.y);
		return Math.sqrt((x * x) + (y * y));
	}
}

function point_distance (point1, point2) {
	const x = (point1.x - point2.x);
	const y = (point1.y - point2.y);
	return Math.sqrt((x * x) + (y * y));
}

// -- rect --------------------------------------------------------------------
// rect defined by x, y, width and height

class rect {
	constructor (x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	expand (pad_x, pad_y) {
		this.x -= pad_x;
		this.y -= pad_y;
		this.width += (pad_x * 2);
		this.height += (pad_y * 2);
	}

	contains_point (p) {
		return (p.x >= this.x && p.y >= this.y && p.x <= this.x + this.width && p.y <= this.y + this.height);
	}

	expand_to_include_point (p) {
		if (p.x < this.x) {
			this.width = (this.x + this.width) - p.x;
			this.x = p.x;
		} else if (p.x > this.x + this.width) {
			this.width = p.x - this.x;
		}

		if (p.y < this.y) {
			this.height = (this.y + this.height) - p.y;
			this.y = p.y;
		} else if (p.y > this.y + this.height) {
			this.height = p.y - this.y;
		}
	}
}

function expanded_rect (r, pad_x, pad_y) {
	return new rect(r.x - pad_x, r.y - pad_x, r.width + (pad_x * 2), r.height + (pad_y * 2));
}

function combined_rect_and_point (r, p) {
	if (r == null) {
		return new rect(p.x, p.y, 0, 0);
	}

	let x = r.x;
	let y = r.y;
	let width = r.width;
	let height = r.height;
	if (p.x < x) {
		width = (x + width) - p.x;
		x = p.x;
	} else if (p.x > x + width) {
		width = p.x - x;
	}

	if (p.y < y) {
		height = (y + height) - p.y;
		y = p.y;
	} else if (p.y > y + height) {
		height = p.y - y;
	}

	return new rect(x, y, width, height);
}

// -- transform --------------------------------------------------------------------
// 2d affine transform, but not defined using a matrix

class transform {
	constructor (x, y, scale_x, scale_y, rotation, alpha) {
		this.x = x;
		this.y = y;
		this.scale_x = scale_x;
		this.scale_y = scale_y;
		this.rotation = rotation;
		this.alpha = alpha;
	}

	static identity () {
		return new transform(0, 0, 1, 1, 0, 1);
	}

	multiply (t) {
		const flip_x = Math.sign(this.scale_x) != Math.sign(t.scale_x);
		const flip_y = Math.sign(this.scale_y) != Math.sign(t.scale_y);
		const flip_rotation = 1 * (flip_x ? -1 : 1) * (flip_y ? -1 : 1);

		// special case for rotation
		if (this.rotation == 0) {
			return new transform(
				this.x + (this.scale_x * t.x),
				this.y + (this.scale_y * t.y),
				this.scale_x * t.scale_x,
				this.scale_y * t.scale_y,
				this.rotation + (t.rotation * flip_rotation),
				this.alpha * t.alpha
			);
		} else {
			const c = Math.cos(this.rotation);
			const s = Math.sin(this.rotation);

			return new transform(
				this.x + (this.scale_x * t.x * c) - (this.scale_y * t.y * s),
				this.y + (this.scale_y * t.y * c) + (this.scale_x * t.x * s),
				this.scale_x * t.scale_x,
				this.scale_y * t.scale_y,
				this.rotation + (t.rotation * flip_rotation),
				this.alpha * t.alpha
			);
		}
	}

	transform_point (p) {
		// special case for 0 rotation
		if (this.rotation == 0) {
			return new point(this.x + (this.scale_x * p.x), this.y + (this.scale_y * p.y));
		} else {
			const c = Math.cos(this.rotation);
			const s = Math.sin(this.rotation);
			return new point(
				this.x + (this.scale_x * p.x * c) - (this.scale_y * p.y * s),
				this.y + (this.scale_y * p.y * c) + (this.scale_x * p.x * s)
			);
		}
	}

	untransform_point (p) {
		// special case for 0 rotation
		if (this.rotation == 0) {
			return new point((p.x - this.x) / this.scale_x, (p.y - this.y) / this.scale_y);
		} else {
			const c = Math.cos(-this.rotation);
			const s = Math.sin(-this.rotation);
			const x = (p.x - this.x) / this.scale_x;
			const y = (p.y - this.y) / this.scale_y;
			return new point((this.scale_x * x * c) - (this.scale_y * y * s), (this.scale_y * y * c) - (this.scale_x * x * s));
		}
	}
}

// -- color --------------------------------------------------------------------
// colour class to share and link to drawing commands, 0 - 1 rgba

class color {
	constructor (r, g, b, alpha) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.alpha = alpha ?? 1;
	}

	fill_style () {
		return 'rgb(' + Math.floor(this.r * 255) + ',' + Math.floor(this.g * 255) + ',' + Math.floor(this.b * 255) + ')';
	}

	static grey (grey_level, alpha) {
		return new color(grey_level, grey_level, grey_level, alpha ? alpha : 1);
	}
}

color.white = new color(1, 1, 1, 1);
color.black = new color(0, 0, 0, 1);
color.clear = new color(0, 0, 0, 0);

// -- font --------------------------------------------------------------------
// font class to link to canvas drawing commands
// also provides measurement and line breaking

class font {
	constructor (ctx, size, name, align = null, init_values = null) {
		this.ctx = ctx;
		this.size = (size != undefined ? size : 11);
		this.name = (name != undefined ? name : 'sans-serif');

		// init values could be in 4th or 5th place
		if (init_values == null && (typeof align != 'string')) {
			init_values = align;
			align = null;
		}

		// default values
		this.align = (align != undefined ? align : 'start');
		this.baseline = 'middle';
		this.font = this.size + 'px ' + this.name;
		this.bold = false;

		// override with init values
		if (init_values) {
			for (const k in init_values) {
				this[k] = init_values[k];
			}
		}

		// measure the line height as soon as we can
		this.set();
		const measure = ctx.measureText('L');
		if (measure.emHeightDescent) {
			this.line_height = measure.emHeightDescent + measure.emHeightAscent;
		} else {
			this.line_height = size;
		}
	}

	set (ctx) {
		if (ctx == undefined) {
			ctx = this.ctx;
		}
		ctx.font = (this.bold ? 'bold ' : ' ') + this.font;
		ctx.textAlign = this.align;
		ctx.textBaseline = this.baseline;
	}

	measure_string (str) {
		this.set();
		return this.ctx.measureText(str).width;
	}

	breaklines (text, word_wrap) {
		if (word_wrap == undefined || word_wrap == 0 || text == null) {
			return [text];
		} else {
			const lines = [];
			let current_line = '';
			let current_line_width = 0;
			let current_word = '';
			let current_word_width = 0;
			let last_word_count = 0;
			for (const char of text) {
				const can_break = (char === ' ' || char === '.' || char === '\t' || char === ',');
				const width = this.measure_string(char);

				if (char == '\n' || (current_line != '' && width + current_word_width + current_line_width > word_wrap)) {
					// move to the next line
					lines.push(current_line.trim());
					current_line = '';
					current_line_width = 0;
					last_word_count = 0;
				}
				// add char to the current word (unless that word is longer than word wrap)
				if (current_word_width < word_wrap) {
					current_word = current_word + char;
					current_word_width += width;
				}
				if (can_break) {
					current_line = current_line + current_word;
					current_line_width += current_word_width;
					current_word = '';
					current_word_width = 0;
					last_word_count++;
				}
			}
			if (current_word != '') {
				current_line = current_line + current_word;
				last_word_count++;
			}
			if (current_line != '') {
				lines.push(current_line.trim());
			}

			// check for a hanging orphan line
			if (lines.length >= 2 && last_word_count == 1) {
				// see if we can steal a word from the previous line
				const previous_line = lines[lines.length - 2];
				let break_point = previous_line.length;
				while (break_point > 1) {
					break_point--;
					const char = previous_line.charAt(break_point);
					const can_break = (char === ' ' || char === '.' || char === '\t' || char === ',');
					if (can_break) {
						// check if a substitute works
						const new_last_line = previous_line.substr(break_point + 1) + ' ' + lines[lines.length - 1];
						if (this.measure_string(new_last_line) < word_wrap) {
							lines[lines.length - 1] = new_last_line;
							lines[lines.length - 2] = previous_line.substr(0, break_point);
						}
						break;
					}
				}
			}

			return lines;
		}
	}

	measure (text, word_wrap) {
		let x = 0;
		let y = 0;

		const lines = this.breaklines(text, word_wrap);
		const width = (lines.length == 1) ? this.measure_string(lines[0]) : word_wrap;
		const height = lines.length * this.line_height;

		// TODO: adjust for baseline and hanging
		y -= this.line_height * 0.5;

		// adjust for text align
		// TODO: check locale with respect to start and end
		if (this.align == 'start' || this.align == 'left') {
			// do nothing
		} else if (this.align == 'center') {
			x -= width * 0.5;
		} else if (this.align == 'end' || this.align == 'right') {
			x -= width;
		}

		return {
			x : x,
			y : y,
			width : width,
			height : height,
			lines : lines,
			line_height : this.line_height,
			padding : this.line_height * 0.5,
		};
	}
}

// -- image data --------------------------------------------------------------------
// define regions and sprites within larger textures, mostly for loading from external
// texture maps

class image_data {
	constructor (name, texture, xy, uv) {
		this.name = name;
		this.texture = texture;

		this.source_rect = new rect(uv[0] * texture.width, uv[1] * texture.height, (uv[2] - uv[0]) * texture.width, (uv[3] - uv[1]) * texture.height);
		this.dest_rect = new rect(xy[0], xy[1], xy[2] - xy[0], xy[3] - xy[1]);
	}

	bounds () {
		return this.dest_rect;
	}

	expand_for_tiling (amount = 0.1) {
		this.source_rect.expand(-amount, -amount);
		this.dest_rect.expand(amount, amount);
	}
}

// -- animations data --------------------------------------------------------------------

// -- clip entry --------------------------------------------------------------------
// not exported, refers to the position of one child object within one frame of an animation

class clip_entry extends transform {
	constructor (instance_name, x, y, scale_x, scale_y, rotation, alpha) {
		super(
			(x !== undefined) ? x : 0,
			(y !== undefined) ? y : 0,
			(scale_x !== undefined) ? scale_y : 0,
			(scale_y !== undefined) ? scale_y : 0,
			(rotation !== undefined) ? rotation : 0,
			(alpha !== undefined) ? alpha : 0
		);
		this.instance_name = instance_name;
	}

	static image_data (instance_name, image_data, x, y, scale_x, scale_y, rotation, alpha) {
		const entry = new clip_entry(instance_name, x, y, scale_x, scale_y, rotation, alpha);
		entry.image_data = image_data;
		return entry;
	}

	static clip_data (instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no) {
		const entry = new clip_entry(instance_name, x, y, scale_x, scale_y, rotation, alpha);
		entry.clip_data = clip_data;
		entry.frame_no = frame_no;
		return entry;
	}

	static display_list_data (instance_name, x, y, scale_x, scale_y, rotation, alpha) {
		return new clip_entry(instance_name, x, y, scale_x, scale_y, rotation, alpha);
	}
}

// -- clip frame --------------------------------------------------------------------
// not exported, aggregate of all entries for a frame, and a label

class clip_frame {
	constructor (label) {
		this.label = label;
		this.content = [];
	}

	generate_instance_name (name, data) {
		let count = 1;
		for (const c of this.content) {
			if (c.image_data == data || c.clip_data == data) {
				count++;
			}
		}
		return '_' + name + '_' + count;
	}

	add_image_content (instance_name, image_data, x, y, scale_x, scale_y, rotation, alpha) {
		if (!instance_name) {
			instance_name = this.generate_instance_name('img_' + image_data.name, image_data);
		}
		const entry = clip_entry.image_data(instance_name, image_data, x, y, scale_x, scale_y, rotation, alpha);
		this.content.push(entry);
		return this;
	}

	add_clip_content (instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no) {
		if (!instance_name) {
			instance_name = this.generate_instance_name('img_' + clip_data.name, clip_data);
		}
		const entry = clip_entry.clip_data(instance_name, clip_data, x, y, scale_x, scale_y, rotation, alpha, frame_no);
		this.content.push(entry);
		return this;
	}

	add_display_list_content (instance_name, x, y, scale_x, scale_y, rotation, alpha) {
		if (!instance_name) {
			throw 'cannot add display list to frame data without instance name';
		}
		const entry = clip_entry.display_list_data(instance_name, x, y, scale_x, scale_y, rotation, alpha);
		this.content.push(entry);
		return this;
	}
}

// -- clip data --------------------------------------------------------------------
// animation sequence, with nested clips

class clip_data {
	constructor (name) {
		this.name = name;
		this.frames = [];
		this.labels = new Map();
	}

	add_frame (label) {
		const frame = new clip_frame(label);
		this.frames.push(frame);
		return frame;
	}

	link_resource (resource, alert_on_error) {
		// generate start and end points for all labels during this pass
		this.labels.set('all', { start_frame : 1, end_frame: this.frames.length });
		let tracking_label = null;
		let frame_no = 0;
		for (const frame of this.frames) {
			frame_no++;
			if (frame.label) {
				tracking_label = { start_frame : frame_no, end_frame : frame_no };
				this.labels.set(frame.label, tracking_label);
			} else if (tracking_label) {
				tracking_label.end_frame = frame_no;
			}

			// -- link image_data and clip_data objects directly
			for (const c of frame.content) {
				if (c.image_data && typeof c.image_data == 'string') {
					const id = get_image_data(c.image_data);
					if (id) {
						c.image_data = id;
					} else if (alert_on_error) {
						alert('missing image data ' + c.image_data);
					}
				}
				if (c.clip_data && typeof c.clip_data == 'string') {
					const cd = get_clip_data(c.clip_data);
					if (cd) {
						c.clip_data = cd;
					} else if (alert_on_error) {
						alert('missing clip data ' + c.clip_data);
					}
				}
			}
		}
	}
}

export { point, rect, transform, point_distance, expanded_rect, combined_rect_and_point, color, font, image_data, clip_data };


// ======================================================================================
// resources
// ======================================================================================

// require_asset() will return null but will also trigger the asset to be loaded
// keep calling require_asset() on a frame timer until the asset is ready

// -- local cache of resource ---------------------
const cache = new Map();
const all_image_data = new Map();
const all_clip_data = new Map();

function get_image_data (name) {
	return all_image_data.get(name);
}

function get_clip_data (name) {
	return all_clip_data.get(name);
}

function get_combined_clip_data (from_clips) {
	// combine multiple clips, using the clip name as a default label where one does not exist
	const combined_clip_data = new clip_data();
	for (const clip_name of from_clips) {
		const other_data = all_clip_data.get(clip_name);
		//  create a label for the whole clip being combined
		combined_clip_data.labels.set(clip_name, { start_frame: combined_clip_data.frames.length + 1, end_frame: combined_clip_data.frames.length + other_data.frames.length });
		// merge in labels for this other clip
		for (const [name, frames] of other_data.labels) {
			combined_clip_data.labels.set(name, {
				start_frame: frames.start_frame + combined_clip_data.frames.length,
				end_frame: frames.end_frame + combined_clip_data.frames.length,
			});
		}
		for (const frame of other_data.frames) {
			combined_clip_data.frames.push(frame);
		}
	}
	combined_clip_data.link_resource();
	return combined_clip_data;
}

function create_combined_clip_data (name, clips) {
	all_clip_data.set(name, get_combined_clip_data(clips));
	all_clip_data.get(name).name = name;
	return all_clip_data.get(name);
}

function create_clip (name, frames, defer_link) {
	const clip_data = new clip_data(name);
	if (frames && Array.isArray(frames)) {
		for (const frame of frames) {
			// special case where each frame is only a single image
			if (typeof frame == 'string') {
				const frame_data = clip_data.add_frame(null);
				frame_data.add_image_content(
					null,
					all_image_data.get(frame),
					0, 0, 1, 1, 0, 1
				);

			} else {
				const frame_data = clip_data.add_frame(frame.label);
				if (frame.content && Array.isArray(frame.content)) {
					for (const entry of frame.content) {
						if (entry.image) {
							frame_data.add_image_content(
								entry.name,
								entry.image,
								entry.transform[0],
								entry.transform[1],
								entry.transform[2],
								entry.transform[3],
								entry.transform[4],
								entry.transform[5]
							);
						} else if (entry.clip) {
							frame_data.add_clip_content(
								entry.name,
								entry.clip,
								entry.transform[0],
								entry.transform[1],
								entry.transform[2],
								entry.transform[3],
								entry.transform[4],
								entry.transform[5],
								entry.transform[6]
							);
						} else {
							// do we need to detect unrecognised entries here?
							frame_data.add_display_list_content(
								entry.name,
								entry.transform[0],
								entry.transform[1],
								entry.transform[2],
								entry.transform[3],
								entry.transform[4],
								entry.transform[5],
								entry.transform[6]
							);
						}
					}
				}
			}
		}
	}

	all_clip_data.set(name, clip_data);
	if (!defer_link) {
		clip_data.link_resource({
			get_image_data : get_image_data,
			get_clip_data : get_clip_data,
		});
	}
	return clip_data;
}

function get_cached (type, name, url, retrieve_callback) {
	const key = type + ':' + name + ':' + url;
	let entry = cache.get(key);
	if (entry == null) {
		entry = {
			key : key,
			type : type,
			name : name,
			url : url,
			loaded : false,
			object : null,
		};
		cache.set(key, entry);
		retrieve_callback(entry);
	}

	if (entry.loaded) {
		return entry.object;
	}
}

function clear_cached (entry) {
	cache.delete(entry.key);
}

function require_image (url) {
	return get_cached('image', url, url, (entry) => {
		entry.object = new Image();
		entry.object.onload = function () {
			entry.loaded = true;
		};
		entry.object.onerror = function () {
			clear_cached(entry);
		};
		entry.object.src = url;
	});
}

function require_json (url) {
	return get_cached('json', url, url, (entry) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function () {
			let status;
			if (xhr.readyState == 4) { // `DONE`
				status = xhr.status;
				if (status == 200) {
					entry.loaded = true;
					entry.object = JSON.parse(xhr.responseText);
				} else {
					clear_cached(entry);
				}
			}
		};
		xhr.send();
	});
}

function require_text (url) {
	return get_cached('text', url, url, (entry) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		xhr.onreadystatechange = function () {
			let status;
			if (xhr.readyState == 4) { // `DONE`
				status = xhr.status;
				if (status == 200) {
					entry.loaded = true;
					entry.object = xhr.responseText;
				} else {
					clear_cached(entry);
				}
			}
		};
		xhr.send();
	});
}

function require_asset (base_url, name) {
	return get_cached('asset', name, base_url + name, (entry) => {
		// first make sure we have the data needed
		const json = require_json(base_url + name + '_description.json');
		if (json == null) {
			clear_cached(entry);
			return;
		}
		entry.description = json;

		// now load all the required spritesheets
		let has_all_sheets = true;
		for (const sheet of entry.description.sheets) {
			if (sheet.image == null) {
				const image = require_image(base_url + sheet.file);
				if (image == null) {
					has_all_sheets = false;
				} else {
					sheet.image = image;
				}
			}
		}

		if (!has_all_sheets) {
			clear_cached(entry);
			return;
		}

		// TODO: set up all the clip and image objects
		entry.loaded = true;
		entry.object = {
			image_data : {},
			clip_data : {},
		};

		// load all supplied images for each sheet
		for (const sheet of entry.description.sheets) {
			if (Array.isArray(sheet.entries)) {
				for (const e of sheet.entries) {
					// add an image data entry per image
					const image_data = new image_data(e.name, sheet.image, e.xy, e.uv);
					all_image_data.set(e.name, image_data);
					entry.object.image_data[e.name] = image_data;
				}
			}
		}

		// create clip_data object for each clip_data
		const clips_added = [];
		if (entry.description.clips && Array.isArray(entry.description.clips)) {
			for (const clip of entry.description.clips) {
				const clip_data = create_clip(clip.name, clip.frames, true);
				entry.object.clip_data[clip_data.name] = clip_data;
				clips_added.push(clip_data);
			}
		}

		// second pass
		// re-link all image_data or clip_data in the asset bundles from name to data
		// create frame label entries for all clips with start and end points
		for (const cd of clips_added) {
			cd.link_resource({
				get_image_data : get_image_data,
				get_clip_data : get_clip_data,
			});
		}
	});
}

function late_link_clips (alert_on_error) {
	for (const cd of all_clip_data.values()) {
		cd.link_resource({
			get_image_data : get_image_data,
			get_clip_data : get_clip_data,
		}, alert_on_error);
	}
}

function require_assets (base_url, names) {
	// return true if all requested assets are available
	let available = true;
	for (const name of names) {
		if (require_asset(base_url, name) == null) {
			available = false;
		}
	}
	return available;
}

export { require_asset, require_assets, require_json, require_image, require_text, get_image_data, get_clip_data, create_clip, create_combined_clip_data, get_combined_clip_data, late_link_clips };

// ======================================================================================
// display list, implements a range of AS3 style display list classes, rendering into a 2D canvas context
// ======================================================================================

// handle scale factor for pixel frozen assets
let default_freeze_scale = 1;
function set_default_freeze_scale (scale) {
	default_freeze_scale = scale;
}

class display_list extends transform {
	constructor (init_values) {
		super(0, 0, 1, 1, 0, 1);
		// this.name = null;
		// this.parent = null;
		// this.children = null;
		// this.visibility_test = null;

		this.visible = true;

		if (init_values) {
			for (const k in init_values) {
				this[k] = init_values[k];
			}
		}
	}

	// -- manage children ------------

	get_children () {
		if (!this.children) {
			this.children = [];
		}
		return this.children;
	}

	get_child (name) {
		if (this.children) {
			for (const child of this.children) {
				if (child.name == name) {
					return child;
				}
			}
		}
		return null;
	}

	add (display) {
		if (display.parent) {
			display.remove_from_parent();
		}
		this.get_children().push(display);
		display.parent = this;
		return display;
	}

	add_at_index (display, index) {
		if (display.parent) {
			display.remove_from_parent();
		}
		this.get_children().splice(index, 0, display);
		display.parent = this;
	}

	send_to_front (display) {
		if (display) {
			if (display.parent) {
				display.remove_from_parent();
			}
			this.get_children().push(display);
			display.parent = this;
		} else if (this.parent) {
			this.parent.send_to_front(this);
		}
	}

	send_to_back (display) {
		if (display) {
			this.add_at_index(display, 0);
		} else if (this.parent) {
			this.parent.send_to_back(this);
		}
	}

	remove (display) {
		if (display.parent == this) {
			const index = this.children.indexOf(display);
			this.children.splice(index, 1);
			display.parent = null;
		}
	}

	remove_from_parent () {
		if (this.parent) {
			this.parent.remove(this);
		}
	}

	remove_all_children () {
		if (this.children) {
			for (const child of this.children) {
				child.parent = null;
			}
			this.children = null;
		}
	}

	// -- transforms -----------------

	transform () {
		return this;	// assume I'm going to regret this at some point...
	}

	world_transform () {
		if (this.parent) {
			return this.parent.world_transform().multiply(this);
		} else {
			return this;
		}
	}

	local_to_world (point) {
		return this.world_transform().transform_point(point);
	}

	world_to_local (point) {
		return this.world_transform().untransform_point(point);
	}

	// -- bounds ----------------------

	bounds (reference) {
		// starting point
		let rect = this.frozen_bounds;
		if (rect == null) {
			rect = this.content_bounds();
			// expand to fit children
			if (this.children) {
				for (const child of this.children) {
					const sub_rect = child.bounds();
					if (sub_rect) {
						// all points of the bound transformed
						const points = [
							child.transform_point(new point(sub_rect.x, sub_rect.y)),
							child.transform_point(new point(sub_rect.x + sub_rect.width, sub_rect.y)),
							child.transform_point(new point(sub_rect.x, sub_rect.y + sub_rect.height)),
							child.transform_point(new point(sub_rect.x + sub_rect.width, sub_rect.y + sub_rect.height)),
						];
						for (let j = 0; j < 4; j++) {
							rect = combined_rect_and_point(rect, points[j]);
						}
					}
				}
			}
		}
		// convert to requested reference point
		if (!rect || !reference) {
			return rect;
		} else {
			const world = this.world_transform();
			const points = [
				world.untransform_point(new point(rect.x, rect.y)),
				world.untransform_point(new point(rect.x + rect.width, rect.y)),
				world.untransform_point(new point(rect.x, rect.y + rect.height)),
				world.untransform_point(new point(rect.x + rect.width, rect.y + rect.height)),
			];
			const ref = reference.world_transform();
			for (let j = 0; j < 4; j++) {
				rect = combined_rect_and_point(rect, ref.untransform_point(ref, points[j]));
			}
			return rect;
		}
	}

	content_bounds () {
		// get bounds without any reference point
		// derived classes should implement only this method
		return null;
	}

	is_visible () {
		if (!this.visible || this.alpha < 0.01) {
			return false;
		}

		if (this.parent) {
			return this.parent.is_visible();
		}

		return true;
	}

	// -- cache/freeze as bitmap ------------------------

	// display.freeze_fast freeze to image_data that is rendered using image_data instead of as a canvas

	freeze (optional_bounds, scale_factor) {
		if (optional_bounds == undefined) {
			optional_bounds = this.bounds();
		}
		if (scale_factor == undefined) {
			scale_factor = default_freeze_scale;
		}

		this.frozen_bounds = optional_bounds;
		let temporary_ctx = null;
		const required_width = this.frozen_bounds.width * scale_factor;
		const required_height = this.frozen_bounds.height * scale_factor;

		if (this.frozen_image_canvas == null || this.frozen_image_canvas.width != required_width || this.frozen_image_canvas.height != required_height) {
			// new or different size
			this.frozen_image_canvas = document.createElement('canvas');
			this.frozen_image_canvas.width = required_width;
			this.frozen_image_canvas.height = required_height;
			temporary_ctx = this.frozen_image_canvas.getContext('2d');
		} else {
			// clear and re-use
			temporary_ctx = this.frozen_image_canvas.getContext('2d');
			temporary_ctx.clearRect(0, 0, this.frozen_image_canvas.width, this.frozen_image_canvas.height);
		}

		const transform = transform.identity();

		transform.x = -this.frozen_bounds.x * scale_factor;
		transform.y = -this.frozen_bounds.y * scale_factor;
		transform.scale_x = transform.scale_y = scale_factor;
		if (this.content_render) {
			this.content_render(temporary_ctx, transform);
		}
		if (this.children) {
			for (const child of this.children) {
				child.render(temporary_ctx, transform);
			}
		}

		// this.frozen_image_data = temporary_ctx.getImageData(0, 0, this.frozen_bounds.width, this.frozen_bounds.height);
		this.is_frozen = true;
	}

	unfreeze () {
		this.is_frozen = false;
		this.frozen_image_canvas = null;
		this.frozen_bounds = null;
	}

	// -- render -----------------------------------------

	update_animated_clips (delta, add_oncomplete_callback) {
		if (this.update) {
			this.update(delta, add_oncomplete_callback);
		}
		if (this.children) {
			for (const child of this.children) {
				child.update_animated_clips(delta, add_oncomplete_callback);
			}
		}
	}

	render (ctx, with_transform) {
		if (!this.visible || this.alpha == 0) {
			return;
		}

		// transform within parent
		const transform = with_transform.multiply(this);
		if (transform.alpha < 0.001) {
			return;
		}

		// TODO: if this.visibility_test, then check this test against screen bounds before continuing

		if (this.is_frozen) {
			ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
			ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = transform.alpha;
			ctx.drawImage(this.frozen_image_canvas, 0, 0, this.frozen_image_canvas.width, this.frozen_image_canvas.height,
				this.frozen_bounds.x, this.frozen_bounds.y, this.frozen_bounds.width, this.frozen_bounds.height);
			ctx.restore();

		} else {
			if (this.content_render) {
				this.content_render(ctx, transform);
			}
			if (this.children) {
				for (const child of this.children) {
					child.render(ctx, transform);
				}
			}
		}
	}

	// TODO: set_visibilty_test_from_current_bounds()
	// create a visibilty test function based on the current content bounds of this display list, + optional padding

	// -- override / customise for different display object types ------------

	// display_list.update = function (delta) {} // update animations
	// display_list.content_render = function (ctx, transform) {} // render actual content at this level with the given transform
}

// -- derived type rendering an image

class image extends display_list {

	constructor (image_data_or_name, init_values) {
		super(init_values);
		this.set_image(image_data_or_name);
	}
	
	set_image(image_data_or_name) {
		if (typeof image_data_or_name == 'string') {
			this.image_data = get_image_data(image_data_or_name);
			if (!this.image_data) {
				console.log('did not find image ' + image_data_or_name);
			}
		} else {
			this.image_data = image_data_or_name;
		}
	}

	content_render (ctx, transform) {
		if (this.image_data) {
			ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.rotate(transform.rotation);
			ctx.scale(transform.scale_x, transform.scale_y);
			ctx.globalAlpha = transform.alpha;
			const src = this.image_data.source_rect;
			const dst = this.image_data.dest_rect;
			ctx.drawImage(this.image_data.texture, src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height);
			ctx.restore();
		}
	}

	content_bounds () {
		return this.image_data.bounds();
	}

}

// -- derived type rendering an image

class clip extends display_list {

	constructor (clip_data_or_name, init_values) {
		super(init_values);
		this.children = [];

		if (typeof clip_data_or_name == 'string') {
			this.clip_data = get_clip_data(clip_data_or_name);
		} else {
			this.clip_data = clip_data_or_name;
		}

		this.playback_speed = 1;
		this.playback_position = 1;

		this.is_playing = false;
		this.start_frame = 1;
		this.end_frame = this.clip_data.frames.length;
		this.loop = true;

		this.current_frame = null;
		this.set_frame(this.clip_data.frames[0]);
	}

	stop () {
		this.is_playing = false;
	}

	play (arg1, arg2, arg3, arg4) {
		this.is_playing = true;
		this.on_complete = null;

		let label_was_set = false;
		let loop_was_set = false;
		let on_complete_was_set = false;

		const args = [arg1, arg2, arg3, arg4];
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (typeof arg == 'boolean') {
				loop_was_set = true;
				this.loop = arg;
			} else if (typeof arg == 'string') {
				if (label_was_set) {
					throw 'only one label string argument is allowed';
				} else {
					if (!loop_was_set) {
						this.loop = false;
					}
					const frames = this.clip_data.labels.get(arg);
					if (!frames) {
						throw 'unknown label ' + arg + ' in clip ' + this.clip_data.name;
					}
					this.start_frame = frames.start_frame;
					this.end_frame = frames.end_frame;
					this.playback_position = this.start_frame;
					label_was_set = true;
				}
			} else if (typeof arg == 'function') {
				if (on_complete_was_set) {
					throw 'only one on_complete function argument is allowed';
				}
				if (!loop_was_set) {
					this.loop = false;
				}
				this.on_complete = arg;
				on_complete_was_set = true;
			}

		}
		// -- check for start and end labels specified as numbers
		if (typeof arg1 == 'number' && typeof arg2 == 'number') {
			if (label_was_set) {
				throw 'cannot set a label and frame numbers';
			}
			this.start_frame = arg1;
			this.end_frame = arg2;
		}

		if (this.loop && this.on_complete) {
			throw 'on_complete will not be used with looping animation';
		}
	}

	goto (label_or_number) {
		if (typeof label_or_number == 'number') {
			this.start_frame = label_or_number;
			this.end_frame = label_or_number;
		} else {
			const frames = this.clip_data.labels.get(label_or_number);
			if (!frames) {
				throw 'unknown frame ' + label_or_number + ' in clip ' + this.clip_data.name;
			}
			this.start_frame = frames.start_frame;
			this.end_frame = frames.start_frame;
		}

		this.is_playing = false;
		this.set_frame(this.clip_data.frames[this.start_frame - 1]);
	}

	update (delta, add_oncomplete_callback) {
		if (!this.is_playing) {
			return;
		}

		this.playback_position += this.playback_speed;
		if (Math.floor(this.playback_position) > this.end_frame) {
			if (this.loop) {
				while (Math.floor(this.playback_position) > this.end_frame) {
					this.playback_position -= (this.end_frame - this.start_frame) + 1;
				}
			} else {
				this.playback_position = this.end_frame;
				this.is_playing = false;
			}
		}

		const frame = this.clip_data.frames[Math.floor(this.playback_position) - 1];
		if (frame != this.current_frame) {
			this.set_frame(frame);
		}

		if (!this.is_playing) {
			if (this.on_complete) {
				add_oncomplete_callback(this.on_complete);
				this.on_complete = null;
			}
		}
	}

	set_frame (frame) {
		if (!frame) {
			throw 'setting invalid frame';
		}
		this.current_frame = frame;

		// -- retain a list of current content (re-use objects where they match)
		const current = new Map();
		for (const [index, child] of this.children.entries()) {
			if (child.name) {
				current.set(child.name, child);
			} else {
				current.set('__' + index, child);
			}
		}

		// -- recreate the child display list, re-using objects
		for (const [index, content] of frame.content.entries()) {
			let child = current.get(content.instance_name);

			// check if types match before re-using an existing
			if (child) {
				if (content.image_data) {
					if (child.image_data != content.image_data) {
						child = null;
					}
				} else if (content.clip_data) {
					if (child.clip_data != content.clip_data) {
						child = null;
					}
				}
			}

			// re-use existing
			if (child) {
				// -- move it to the correct index
				this.children[index] = child;
				// -- make sure this is not removed later
				current.delete(content.instance_name);
			} else {
				// -- create a new child clip
				if (content.image_data) {
					child = new image(content.image_data);
				} else if (content.clip_data) {
					child = new clip(content.clip_data);
					// -- if frame is not specified then the sub clip should play
					if (!content.frame_no) {
						child.play();
					}
				} else {
					// defaults to empty display list
					child = new display_list();
				}
				child.name = content.instance_name;
				child.parent = this;
				this.children[index] = child;
			}

			// -- apply the new transform
			child.x = content.x;
			child.y = content.y;
			child.scale_x = content.scale_x;
			child.scale_y = content.scale_y;
			child.rotation = content.rotation;
			child.alpha = content.alpha;
			if (content.frame_no) {
				child.goto_and_stop(content.frame_no);
			}
		}

		// -- trim extra child references
		this.children.splice(frame.content.length);
		for (const child of current.values()) {
			child.parent = null;
		}
	}
}

// -- derived type rendering a rectangle

class rectangle extends display_list {

	constructor (width, height, color, init_values) {
		super(init_values);
		this.width = width;
		this.height = height;
		this.color = color;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fill_style();
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.restore();
	}

	content_bounds () {
		return { x : 0, y : 0, width : this.width, height : this.height };
	}

}

class circle extends display_list {
	constructor (radius, color, init_values) {
		super(init_values);
		this.radius = radius;
		this.color = color;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fill_style();
		ctx.beginPath();
		ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}

	content_bounds () {
		return { x : -this.radius, y : -this.radius, width : this.radius * 2, height : this.radius * 2 };
	}
}

class canvas extends display_list {
	constructor (bounds, on_render, init_values) {
		super(init_values);
		this.bounds = bounds;
		this.on_render = on_render;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		this.on_render(ctx);
		ctx.restore();
	}

	content_bounds () {
		return this.bounds;
	}
}

class label extends display_list {
	constructor (font, text, color, init_values) {
		super(init_values);

		// set word_wrap to a number to wrap lines at a maximum length
		// this.word_wrap = undefined;
		this.vertical_align = (this.vertical_align != null ? this.vertical_align : 'center');

		this.font = font;
		this.text = text;
		this.color = (color != undefined ? color : color.black);

		this.last_break = null;
		this.last_lines = null;
	}

	content_render (ctx, transform) {
		ctx.save();
		ctx.translate(transform.x, transform.y);
		ctx.rotate(transform.rotation);
		ctx.scale(transform.scale_x, transform.scale_y);
		ctx.globalAlpha = this.color.alpha * transform.alpha;
		ctx.fillStyle = this.color.fill_style();
		this.font.set(ctx);

		const tx = 0;
		let ty = 0;
		// adjust for vertical_align
		if (this.vertical_align == 'center' || this.vertical_align == 'middle') {
			// do nothing
		} else if (this.vertical_align == 'top') {
			ty += this.font.line_height * 0.5;
		} else if (this.vertical_align == 'bottom') {
			ty -= this.font.line_height * 0.5;
		}

		if (this.word_wrap == undefined) {
			ctx.fillText(this.text, tx, ty);
		} else {
			const this_break = this.word_wrap + ':' + this.text;
			let lines = this.last_lines;
			if (this_break != this.last_break) {
				this.last_break = this_break;
				lines = this.last_lines = this.font.breaklines(this.text, this.word_wrap);
			}
			// adjust for vertical_align
			if (this.vertical_align == 'center' || this.vertical_align == 'middle') {
				ty -= (lines.length - 1) * 0.5 * this.font.line_height;
			} else if (this.vertical_align == 'top') {
				// do nothing
			} else if (this.vertical_align == 'bottom') {
				ty -= (lines.length - 1) * this.font.line_height;
			}

			for (const line of lines) {
				ctx.fillText(line, tx, ty);
				ty += this.font.line_height;
			}
		}
		ctx.restore();
	}

	content_bounds () {
		const font_bounds = this.font.measure(this.text, this.word_wrap);
		const bounds = expanded_rect(font_bounds, font_bounds.padding, font_bounds.padding);

		// adjust for vertical_align
		if (this.vertical_align == 'center' || this.vertical_align == 'middle') {
			bounds.y -= (font_bounds.lines.length - 1) * 0.5 * font_bounds.line_height;
		} else if (this.vertical_align == 'top') {
			bounds.y += font_bounds.line_height * 0.5;
		} else if (this.vertical_align == 'bottom') {
			bounds.y -= (font_bounds.lines.length - 0.5) * font_bounds.line_height;
		}

		return bounds;
	}
}

// -- set up add methods from each class to each other class ----
const class_list = {
	'display_list' : display_list,
	'image' : image,
	'clip' : clip,
	'rectangle' : rectangle,
	'circle' : circle,
	'canvas' : canvas,
	'label' : label,
};

for (const this_class_name in class_list) {
	const this_class = class_list[this_class_name];
	for (const other_class_name in class_list) {
		const other_class = class_list[other_class_name];
		this_class.prototype['add_' + other_class_name] = function () {
			const child = new other_class(...arguments);
			this.add(child);
			return child;
		};
	}
}

export { display_list, image, clip, rectangle, circle, canvas, label, set_default_freeze_scale };

// ======================================================================================
// ui functionality and touch handling
// ======================================================================================

// TODO: remove obsolute module prefix eg. resource.
// TODO: see if event names should be standardised using const for all of these
// TODO: remove any cruft? config_button_touch_outer_padding
// TODO: remove use of context, modals should be defined by their own top level screen object
// TODO: where is dispatch going to live, one instance belongs to the screen

// TODO: derive and the close modal child of a canvas?
// TODO: or just enable/disable touch
// TODO: touch area and button will need a reference to the screen, pick up a default/global here?

// event_dispatch
// event_handler
// is global event dispatch only a UI thing? who else wants it?

class canvas_screen  {
	constructor (canvas, ideal_width, ideal_height, fit) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.ideal_height = ideal_height;
		this.ideal_width = ideal_width;
		this.fit = fit;
		this.root_view = new display.display_list();

		this.update();

		canvas.addEventListener('mousedown', (evt) => {
			this.touch_event('touch_begin', evt);
		}, false);
		canvas.addEventListener('mousemove', (evt) => {
			this.touch_event('touch_move', evt);
		}, false);
		window.addEventListener('mouseup', (evt) => {
			this.touch_event('touch_end', evt);
		}, false);
		canvas.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
		}, false);

		canvas.addEventListener('touchstart', (evt) => {
			this.touch_event('touch_begin', evt);
		}, false);
		canvas.addEventListener('touchmove', (evt) => {
			this.touch_event('touch_move', evt);
		}, false);
		canvas.addEventListener('touchend', (evt) => {
			this.touch_event('touch_end', evt);
		}, false);
		canvas.addEventListener('touchcancel', (evt) => {
			this.touch_event('touch_cancel', evt);
		}, false);
	}

	touch_event (event_name, evt) {
		evt.preventDefault();

		// where will events be dispatched, can be overridden by the context
		const event_dispatch = this.context.get_active().event_dispatch;

		// correct co-ords for hdpi displays
		const scale_x = this.canvas.width / this.canvas.clientWidth;
		const scale_y = this.canvas.height / this.canvas.clientHeight;

		if (evt.changedTouches) {
			for (const touch of evt.changedTouches) {
				event_dispatch.defer(event_name, { id : touch.identifier, time : Date.now(), x : (touch.pageX - this.canvas.offsetLeft) * scale_x, y : (touch.pageY - this.canvas.offsetTop) * scale_y });
			}
		} else {
			event_dispatch.defer(event_name, { id : 1, time : Date.now(), x : (evt.pageX - this.canvas.offsetLeft) * scale_x, y : (evt.pageY - this.canvas.offsetTop) * scale_y });
		}
	}

	update () {
		// update transform of root view to match sizing

		// update scaling to fit nominal sizing to canvas size
		const scale_x = this.canvas.width / this.ideal_width;
		const scale_y = this.canvas.height / this.ideal_height;
		let scale = 1;

		if (this.fit == 'fit') {
			scale = (scale_x < scale_y) ? scale_x : scale_y;
		} else {
			// other screenfit strategies
		}

		this.content_scale = scale;
		this.width = Math.floor(this.canvas.width / scale);
		this.height = Math.floor(this.canvas.height / scale);

		this.root_view.scale_x = scale;
		this.root_view.scale_y = scale;
	}

	render (clear_screen = true) {
		if (clear_screen) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
		this.root_view.render(this.ctx, transform.identity());
	}
}


// export { touch_area, button, scroll_behaviour, canvas_screen, render_callback, fixed_rate_timer };
