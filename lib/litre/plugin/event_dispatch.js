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
		console.log(event_name, details);
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
		this.dispatcher.listen(event_name, callback);
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
	
	// register the plugin with litre
	litre.add_plugin({
		attach: (litre_app) => {
			litre_app.context.set('event_dispatch', shared);
		},
		begin: (node) => {
			node.listen = (event_name, callback, dispatcher) => {
				node.add_disposeable(new event_listener(event_name, callback, dispatcher));
			};
		},
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