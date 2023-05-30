// add touch area, scroll and buttons to litre_pixi
// copyright 2023 Samuel Baird MIT Licence

import * as litre from '../litre.js';
import * as event_dispatch from './event_dispatch.js';

export const EVENT_TOUCH_BEGIN = 'EVENT_TOUCH_BEGIN';
export const EVENT_TOUCH_MOVE = 'EVENT_TOUCH_MOVE';
export const EVENT_TOUCH_CANCEL = 'EVENT_TOUCH_CANCEL';
export const EVENT_TOUCH_END = 'EVENT_TOUCH_END';

export let CONFIG_BUTTON_TOUCH_OUTER_PADDING = 10;
export let CONFIG_BUTTON_ACTION_DELAY = 2;

class touch_area {
	
	constructor (point_conversion, area_test, dispatcher) {
		this.point_conversion = point_conversion;
		this.area_test = area_test;
		
		// receive incoming touch from the DOM
		this.listen_begin = new event_dispatch.event_listener(EVENT_TOUCH_BEGIN, (touch_data) => {
			this.handle_touch_begin(touch_data);
		}, dispatcher);
		this.listen_move = new event_dispatch.event_listener(EVENT_TOUCH_MOVE, (touch_data) => {
			this.handle_touch_move(touch_data);
		}, dispatcher);
		this.listen_cancel = new event_dispatch.event_listener(EVENT_TOUCH_CANCEL, (touch_data) => {
			this.handle_touch_cancel(touch_data);
		}, dispatcher);
		this.listen_end = new event_dispatch.event_listener(EVENT_TOUCH_END, (touch_data) => {
			this.handle_touch_end(touch_data);
		}, dispatcher);

		// initialise values
		this.cancel_touch();

		// clients should supply these
		this.on_touch_begin = null;
		this.on_touch_move = null;
		this.on_touch_end = null;
		this.on_touch_cancel = null;
	}

	cancel_touch () {
		if (this.is_touched) {
			this.is_touched = false;
			if (this.on_touch_cancel) {
				this.on_touch_cancel(this);
			}
		}

		this.is_touched = false;
		this.is_touch_over = false;
		this.touch_id = null;

		this.touch_time = null;
		this.touch_position = null;

		this.touch_start_time = null;
		this.touch_start_position = null;

		this.drag_distance = null;
		this.move_distance = null;
	}

	get enabled () {
		return this.listen_begin.enabled;
	}

	set enabled (value) {
		if (value && !this.listen_begin.enabled) {
			this.listen_begin.enabled = true;
			this.listen_move.enabled = true;
			this.listen_cancel.enabled = true;
			this.listen_end.enabled = true;
		} else if (!value && this.listen_begin.enabled) {
			this.listen_begin.enabled = false;
			this.listen_move.enabled = false;
			this.listen_cancel.enabled = false;
			this.listen_end.enabled = false;
			this.cancel_touch();
		}
	}

	handle_touch_begin (touch_data) {
		if (this.touch_id) {
			// already tracking a touch
			return;
		}			
		if (!this.point_conversion) {
			// no longer valid
			return;
		}	

		const point = this.point_conversion(touch_data);
		const is_touch_over = this.area_test(point);

		if (!is_touch_over) {
			return;
		}

		// -- TODO: check for filtering and intercepts here
		this.is_touched = true;
		this.is_touch_over = true;
		this.touch_id = touch_data.id;

		this.touch_position = point;
		this.touch_time = touch_data.time;

		this.touch_start_position = { x : point.x, y : point.y };
		this.touch_start_time = this.touch_time;

		this.drag_distance = null;
		this.move_distance = null;

		if (this.on_touch_begin) {
			this.on_touch_begin(this);
		}
	}

	handle_touch_move (touch_data) {
		if (this.touch_id != touch_data.id) {
			return;
		}

		this.update_values(this.point_conversion(touch_data), touch_data.time);
		if (this.on_touch_move) {
			this.on_touch_move(this);
		}
	}

	handle_touch_end (touch_data) {
		if (this.touch_id != touch_data.id) {
			return;
		}

		this.update_values(this.point_conversion(touch_data), touch_data.time);
		this.is_touched = false;
		if (this.on_touch_end) {
			this.on_touch_end(this);
		}
		this.cancel_touch();
	}

	handle_touch_cancel (touch_data) {
		if (this.touch_id != touch_data.id) {
			return;
		}
		this.cancel_touch();
	}

	update_values (point, time) {
		const previous_position = this.touch_position;
		this.is_touch_over = this.area_test(point);
		this.touch_position = point;
		this.touch_time = time;

		this.drag_distance = { x : point.x - this.touch_start_position.x, y : point.y - this.touch_start_position.y };
		this.move_distance = { x : point.x - previous_position.x, y : point.y - previous_position.y };
	}

	dispose () {
		if (this.listen_begin) {
			this.listen_begin.dispose();
			this.listen_move.dispose();
			this.listen_cancel.dispose();
			this.listen_end.dispose();
			this.listen_begin = null;
			this.listen_move = null;
			this.listen_cancel = null;
			this.listen_end = null;
		}
		this.on_touch_begin = null;
		this.on_touch_move = null;
		this.on_touch_end = null;
	}

}


class button {

	constructor (target, touch_area, frame_dispatch, action) {
		this.target = target;
		this.touch_area = touch_area;
		this.frame_dispatch = frame_dispatch;
		this.action = action;
		
		this.is_down = false;
		this.is_releasing = false;
		this.update(true);
		
		// set up interaction
		this.touch_area.on_touch_begin = () => { this.update(); };
		this.touch_area.on_touch_move = () => { this.update(); };
		this.touch_area.on_touch_end = () => { this.handle_button_release(); };
		this.touch_area.on_touch_cancel = () => { this.cancel_touch(); };
	}

	get enabled () {
		return this.touch_area && this.touch_area.enabled;
	}

	set enabled (value) {
		if (this.touch_area) {
			this.touch_area.enabled = value;
		}
		this.update();
	}

	is_visible () {
		return this.target.worldVisible;
	}

	update (force) {
		let active = this.enabled && this.is_visible && this.touch_area.is_touched && !this.is_releasing;
		if (active) {
			const rect = this.target.getLocalBounds();
			rect.pad(CONFIG_BUTTON_TOUCH_OUTER_PADDING);
			if (!rect.contains(this.touch_area.touch_position.x, this.touch_area.touch_position.y)) {
				active = false;
			}
		}
		
		if (active) {
			if (!this.is_down || force) {
				this.is_down = true;
				if (this.target.up) {
					this.target.up.visible = false;
				}
				if (this.target.down) {
					this.target.down.visible = true;
				}
				// TODO: add support for 2 frame animations
				// TODO: add support for touch down/up actions and sounds
			}
		} else {
			if (this.is_down || force) {
				this.is_down = false;
				if (this.target.up) {
					this.target.up.visible = true;
				}
				if (this.target.down) {
					this.target.down.visible = false;
				}
				// TODO: add support for 2 frame animations
				// TODO: add support for touch down/up actions and sounds
			}
		}
	}

	handle_button_release () {
		if (this.is_releasing) {
			return;
		}

		if (this.is_down) {
			this.is_releasing = true;
			this.update();
			this.frame_dispatch.delay(CONFIG_BUTTON_ACTION_DELAY, () => {
				this.action?.();
				this.is_releasing = false;
			});
		}
	}

	cancel_touch () {
		if (this.is_releasing) {
			return;
		}

		if (this.touch_area) {
			this.touch_area.cancel_touch();
		}
		this.update();
	}

	dispose () {
		if (this.touch_area) {
			this.touch_area.dispose();
			this.touch_area = null;
		}
		this.target = null;
		this.frame_dispatch = null;
		this.action = null;
	}
}

class scroll_behaviour {
	/*

	constructor (touch_area, view_width, view_height, scroll_parent) {
		this.touch_area = touch_area;
		this.view_width = view_width;
		this.view_height = view_height;
		this.scroll_parent = scroll_parent;

		this.content_x = 0;
		this.content_y = 0;
		this.momentum_x = 0;
		this.momentum_y = 0;

		this.damping = 0.95;
		this.stretch = 0.1;
		this.snap = 0.5;

		this.set_content_size(view_width, view_height);

		this.touch_area.on_touch_move = (ta) => {
			if (ta.is_touched) {
				if (this.scroll_x) {
					const max_x = (this.content_width - this.view_width);
					if (this.content_x < 0 && ta.move_distance.x > 0) {
						this.content_x -= ta.move_distance.x * this.stretch;
					} else if (this.content_x > max_x && ta.move_distance.x < 0) {
						this.content_x -= ta.move_distance.x * this.stretch;
					} else {
						this.content_x -= ta.move_distance.x;
					}

					this.momentum_x = -ta.move_distance.x;
				}
				if (this.scroll_y) {
					const max_y = (this.content_height - this.view_height);
					if (this.content_y < 0 && ta.move_distance.y > 0) {
						this.content_y -= ta.move_distance.y * this.stretch;
					} else if (this.content_y > max_y && ta.move_distance.y < 0) {
						this.content_y -= ta.move_distance.y * this.stretch;
					} else {
						this.content_y -= ta.move_distance.y;
					}

					this.momentum_y = -ta.move_distance.y;
				}
			}
		};

	}

	set_content_size (width, height) {
		this.content_width = width;
		this.content_height = height;
		this.scroll_x = (this.content_width > this.view_width);
		this.scroll_y = (this.content_height > this.view_height);
	}

	set_position (x, y) {
		this.content_x = x;
		this.content_y = y;
		this.momentum_x = 0;
		this.momentum_y = 0;
		this.touch_area.cancel_touch();
	}

	update () {
		// bounce back in when not touched
		if (!this.touch_area.is_touched) {
			if (this.scroll_x) {
				this.content_x += this.momentum_x;

				const max_x = (this.content_width - this.view_width);
				if (this.content_x < 0) {
					this.content_x *= this.snap;
				} else if (this.content_x > max_x) {
					this.content_x = max_x + (this.content_x - max_x) * this.snap;
				}
			}
			if (this.scroll_y) {
				this.content_y += this.momentum_y;

				const max_y = (this.content_height - this.view_height);
				if (this.content_y < 0) {
					this.content_y *= this.snap;
				} else if (this.content_y > max_y) {
					this.content_y = max_y + (this.content_y - max_y) * this.snap;
				}
			}
		}

		this.momentum_x *= this.damping;
		this.momentum_y *= this.damping;

		// update scroll parent if we have it
		if (this.scroll_parent != null) {
			this.scroll_parent.x = -this.content_x;
			this.scroll_parent.y = -this.content_y;
		}
	}

	dispose () {

	}
	
	*/
}

export { touch_area, button, scroll_behaviour };
