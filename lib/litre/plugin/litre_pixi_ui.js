// add touch area, scroll and buttons to litre_pixi
// copyright 2023 Samuel Baird MIT Licence

import * as litre from '../litre.js';
import * as event_dispatch from './event_dispatch.js';

export const EVENT_TOUCH_BEGIN = 'EVENT_TOUCH_BEGIN';
export const EVENT_TOUCH_MOVE = 'EVENT_TOUCH_MOVE';
export const EVENT_TOUCH_CANCEL = 'EVENT_TOUCH_CANCEL';
export const EVENT_TOUCH_END = 'EVENT_TOUCH_END';

// export const config_button_touch_outer_padding = 'config_button_touch_outer_padding';
// export const event_button_down = 'event_button_down';
// export const event_button_up = 'event_button_up';
// const dispatch_delayed_button = 'dispatch_delayed_button';

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

	/*
	// add static constructors
	static bounds (display_object, padding, context) {
		if (padding == undefined) {
			padding = 0;
		}
		return new touch_area(
			// point conversion
			((point) => {
				return display_object.world_to_local(point);
			}),
			// area test
			((point) => {
				let rect = display_object.bounds();
				rect = geometry.expanded_rect(rect, padding, padding);
				return rect.contains_point(point);
			}),
			context
		);
	}

	static rect (display_object, rect, context) {
		return new touch_area(
			// point conversion
			((point) => {
				return display_object.world_to_local(point);
			}),
			// area test
			((point) => {
				return rect.contains_point(point);
			}),
			context
		);
	}
	
	*/
}


// adds two frame button behaviour to an animated display object
// copyright 2020 Samuel Baird MIT Licence

class button {

	/*

	constructor (clip, action, init_values, context) {
		// base properties for a button
		this.clip = clip;
		this.action = action;
		this.context = context;
		this.event_handler = new dispatch.event_handler(context.event_dispatch);

		// override these properties if required
		if (clip.goto != null) {
			// if the clip appears to be an animated clip then default to using these frames as the button states
			this.up_frame = 1;
			this.down_frame = 2;
		}

		if (init_values) {
			for (const k in init_values) {
				this[k] = init_values[k];
			}
		}

		// internal
		this.is_down = false;
		this.is_releasing = false;

		const button_touch_out_padding = context.get('config_button_touch_outer_padding', 20);

		this.touch_area_inner = touch_area.bounds(clip, 0, context);
		this.touch_area_outer = touch_area.bounds(clip, button_touch_out_padding, context);

		this.touch_area_inner.on_touch_begin = () => {
			this.update();
		};
		this.touch_area_inner.on_touch_move = () => {
			this.update();
		};
		this.touch_area_outer.on_touch_begin = () => {
			this.update();
		};
		this.touch_area_outer.on_touch_move = () => {
			this.update();
		};
		this.touch_area_outer.on_touch_end = () => {
			this.handle_button_release();
		};
		this.touch_area_outer.on_touch_cancel = () => {
			this.cancel_touch();
		};
		this.event_handler.listen(dispatch.event_interrupt_context, () => {
			this.context.frame_dispatch.remove(dispatch_delayed_button);
		});
	}

	get enabled () {
		return this.touch_area_inner.enabled && this.touch_area_outer.enabled;
	}

	set enabled (value) {
		if (this.touch_area_inner) {
			this.touch_area_inner.enabled = value;
			this.touch_area_outer.enabled = value;
		}
		this.update();
	}

	is_visible () {
		return this.clip.is_visible();
	}

	update () {
		if (this.enabled && this.is_visible() && this.touch_area_inner.is_touched && this.touch_area_outer.is_touch_over && !this.is_releasing) {
			if (!this.is_down) {
				this.is_down = true;
				if (typeof this.down_frame == 'function') {
					this.down_frame(this);
				} else if (this.clip.goto != null) {
					this.clip.goto(this.down_frame);
				}

				// dispatch an event for global button down
				this.context.event_dispatch.defer(event_button_down, { button: this });
			}
		} else {
			if (this.is_down) {
				this.is_down = false;
				if (typeof this.up_frame == 'function') {
					this.up_frame(this);
				} else if (this.clip.goto != null) {
					this.clip.goto(this.up_frame);
				}

				// dispatch an event for global button up
				this.context.event_dispatch.defer(event_button_up, { button: this });
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

			this.context.frame_dispatch.delay(1, () => {
				this.action(this);
				this.is_releasing = false;
			}, dispatch_delayed_button);
		}
	}

	cancel_touch () {
		if (this.is_releasing) {
			return;
		}

		if (this.touch_area_inner) {
			this.touch_area_inner.cancel_touch();
		}
		if (this.touch_area_outer) {
			this.touch_area_outer.cancel_touch();
		}
		this.update();
	}

	dispose () {
		if (this.touch_area_inner) {
			this.touch_area_inner.dispose();
			this.touch_area_inner = null;
		}
		if (this.touch_area_outer) {
			this.touch_area_outer.dispose();
			this.touch_area_outer = null;
		}
		this.clip = null;
		this.action = null;
	}
	
	*/
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
