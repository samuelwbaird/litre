// add some event dispatch classes and a shared dispatcher
// copyright 2023 Samuel Baird MIT Licence

import { update_list } from '../sequence.js';
import * as litre from '../litre.js';

let shared = null;

class event_dispatcher {
	
	constructor () {
		this.listeners = new Map();
		this.deferred = [];
	}
	
	listen (event_name, callback) {
		if (!this.listeners.has(event_name)) {
			this.listeners.set(event_name, new update_list());
		}		
		this.listeners.get(event_name).add(callback);
	}
	
	unlisten (event_name, callback) {
		const callbacks = this.listeners.get(event_name);
		if (callbacks) {
			callbacks.remove(callback);
		}
	}
	
	dispatch (event_name, details) {
		const callbacks = this.listeners.get(event_name);
		if (callbacks) {
			callbacks.update((callback) => {
				callback(details);
			});
		}
	}
	
	defer (event_name, details) {
		this.deferred.push({
			name: event_name,
			details: details,
		});
	}
	
	dispatch_deferred () {
		if (this.deferred.length > 0) {
			const to_dispatch = this.deferred;
			this.deferred = [];
			for (const event of to_dispatch) {
				this.dispatch(event.name, event.details);
			}
		}
	}
	
	dispose () {
		this.listeners = null;
	}
	
}

class event_listener {
	constructor (event_name, callback, dispatcher) {
		this.event_name = event_name;
		this.callback = callback;
		this.dispatcher = dispatcher ?? shared;
		
		this.enabled = true;
		this.dispatcher.listen(event_name, (details) => {
			if (this.enabled) {
				callback(details);
			}
		});
	}
	
	dispose () {
		if (this.dispatcher) {
			this.dispatcher.unlisten(this.event_name, this.callback);
			this.callback = null;
			this.dispatcher = null;
		}		
	}
}

function initialise_plugin() {
	// don't initialise twice if we have already set up a shared dispatcher
	if (shared) {
		return;
	}
	
	shared = new event_dispatcher();
	
	// update the app_node class wit event methods
	litre.app_node.prototype.event_listen = function (event_name, callback, dispatcher) {
		dispatcher = dispatcher ?? this.context.get('event_dispatch');
		return this.add_disposable(new event_listener(event_name, callback, dispatcher));
	};
	litre.app_node.prototype.event_dispatch = function (event_name, details, dispatcher) {
		dispatcher = dispatcher ?? this.context.get('event_dispatch');
		dispatcher.dispatch(event_name, details);
	};
	litre.app_node.prototype.event_defer = function (event_name, details, dispatcher) {
		dispatcher = dispatcher ?? this.context.get('event_dispatch');
		dispatcher.defer(event_name, details);
	};
	
	// register the plugin with litre
	litre.add_plugin({
		attach: (litre_app) => {
			litre_app.context.set('event_dispatch', shared);
		},
		// begin: (node) => {
		// },
		// prerender: (litre_app) => {
		// },
		update: (litre_app) => {
			shared.dispatch_deferred();
		},
		// postrender: (litre_app) => {
		// },
	});
}

export { initialise_plugin, event_dispatcher, event_listener, shared };