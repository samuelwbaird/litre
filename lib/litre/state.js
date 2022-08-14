// mixed state and stateful switching, and an immutable token to use with it
// copyright 2022 Samuel Baird MIT Licence

// atom, enum or token with properties
// atom ('customer_loaded', { id: 123, data: {} }, [ 'id' ])
// assign a type, properties, and optionally which properties are part of identity comparisons
function atom (type, props, discriminant_properties) {
	const obj = {
		type: type,
		props: props,
		equals: (other) => {
			if (other == null) { return false; }
			if (other.type != obj.type) { return false; }
			if (discriminant_properties) {
				for (const p of discriminant_properties) {
					if (obj.props[p] != other.props[p]) {
						return false;
					}
				}
			}
			return true;
		},
	};
	if (props && Object.getPrototypeOf(props) === Object.prototype) {
		Object.freeze(props);
	}
	Object.freeze(obj);
	return obj;
}

// state switch (discriminant, on begin, on maintain, on end)
// update the switch in a stateless manner, and this will be converted to
// stateful switches between different action as the state changes
class state_switch {

	// if init array is supplied it is interpreted as an array of arrays
	// each inner array supplying arguments to the add function
	constructor (init_array = null) {
		this.switches = [];
		this.active_switch = null;
		this.last_value = null;

		if (init_array) {
			for (const inner of init_array) {
				this.add(inner[0], inner[1], inner[2], inner[3]);
			}
		}
	}

	add (check, action, end_action = null, update_action = null) {
		// if check function is a string, it will be assumed to be a function matching that atom type
		if (typeof check == 'string') {
			const type = check;
			check = (value) => {
				if (value != null && value.type == type) {
					return value;
				}
			};
		}

		this.switches.push({
			check: check,
			action: (action ? action : () => {}),
			end_action: (end_action ? end_action : () => {}),
			update_action: (update_action ? update_action : () => {}),
		});
	}

	// test all check functions until one is not null or false
	// switch to this state
	// if this state was already current, then restart or update, based on whether the check function result is equal
	update (value) {
		for (const s of this.switches) {
			const result = s.check(value);
			if (result) {
				// is this a continuation of the current switch state
				if (s == this.active_switch && ((result == this.last_value) || (result.equals && result.equals(this.last_value)))) {
					s.update_action(result);
					return;
				}

				// since we are doing a fresh switch, first deactive the previous
				if (this.active_switch) {
					this.active_switch.end_action();
					this.active_switch = null;
				}

				// is this a change or update to the current state
				this.last_value = result;
				this.active_switch = s;
				s.action(result);
				return;
			}
		}

		// nothing matches, clear current switch if any
		if (this.active_switch) {
			this.active_switch.end_action();
			this.active_switch = null;
			this.last_value = null;
		}
	}

}

class app_node_switch {

	// if init array is supplied it is interpreted as an array of arrays
	// each inner array supplying arguments to the add function
	constructor (init_array = null) {
		this.state_switch = new state_switch();
		this.current_node = null;

		if (init_array) {
			for (const inner of init_array) {
				this.add(inner[0], inner[1]);
			}
		}
	}

	add (check, create_app_node, update_app_node) {
		let node = null;
		this.state_switch.add(check,
			(value) => {
				node = create_app_node(value);
				this.set_node(node);
			},
			() => {
				node == null;
				this.set_node(null);
			},
			(value) => {
				if (update_app_node) {
					update_app_node(value);
				} else if (node != null && node.update_state) {
					node.update_state(value);
				}
			},
		);
	}

	set_node (app_node) {
		if (app_node != this.current_node) {
			if (this.current_node) {
				this.current_node.dispose();
				this.current_node = null;
			}

			this.current_node = app_node;
			this.current_node.context = this.context.derive();
			this.current_node.begin();
		}
	}

	update_state (value) {
		this.state_switch.update(value);
	}

	// nothing to do here, just pretending to an an app node

	begin () {
	}

	update () {
		if (this.current_node) {
			this.current_node.update();
		}
	}

	dispose () {
		this.set_node(null);
	}


}

// state effect
// state list, map each item to a switch output and compose
// map each item in a list to an app_node (create, delete and update as needed)
// compose

export { atom, state_switch, app_node_switch };