// add some event dispatch classes and a shared dispatcher
// copyright 2023 Samuel Baird MIT Licence

import { UpdateList } from '../sequence.js';
import * as litre from '../litre.js';

let shared = null;

class EventDispatcher {

	constructor () {
		this.listeners = new Map();
		this.deferred = [];
	}

	listen (eventName, callback) {
		if (!this.listeners.has(eventName)) {
			this.listeners.set(eventName, new UpdateList());
		}
		this.listeners.get(eventName).add(callback);
	}

	unlisten (eventName, callback) {
		const callbacks = this.listeners.get(eventName);
		if (callbacks) {
			callbacks.remove(callback);
		}
	}

	dispatch (eventName, details) {
		const callbacks = this.listeners.get(eventName);
		if (callbacks) {
			callbacks.update((callback) => {
				callback(details);
			});
		}
	}

	defer (eventName, details) {
		this.deferred.push({
			name: eventName,
			details: details,
		});
	}

	dispatchDeferred () {
		if (this.deferred.length > 0) {
			const toDispatch = this.deferred;
			this.deferred = [];
			for (const event of toDispatch) {
				this.dispatch(event.name, event.details);
			}
		}
	}

	dispose () {
		this.listeners = null;
	}

}

class EventListener {
	constructor (eventName, callback, dispatcher) {
		this.eventName = eventName;
		this.callback = callback;
		this.dispatcher = dispatcher ?? shared;

		this.enabled = true;
		this.dispatcher.listen(eventName, (details) => {
			if (this.enabled) {
				callback(details);
			}
		});
	}

	dispose () {
		if (this.dispatcher) {
			this.dispatcher.unlisten(this.eventName, this.callback);
			this.callback = null;
			this.dispatcher = null;
		}
	}
}

function initialisePlugin () {
	// don't initialise twice if we have already set up a shared dispatcher
	if (shared) {
		return;
	}

	shared = new EventDispatcher();

	// update the appNode class wit event methods
	litre.AppNode.prototype.eventListen = function (eventName, callback, dispatcher) {
		dispatcher = dispatcher ?? this.context.get('event_dispatch');
		return this.addDisposable(new EventListener(eventName, callback, dispatcher));
	};
	litre.AppNode.prototype.eventDispatch = function (eventName, details, dispatcher) {
		dispatcher = dispatcher ?? this.context.get('event_dispatch');
		dispatcher.dispatch(eventName, details);
	};
	litre.AppNode.prototype.eventDefer = function (eventName, details, dispatcher) {
		dispatcher = dispatcher ?? this.context.get('event_dispatch');
		dispatcher.defer(eventName, details);
	};

	// register the plugin with litre
	litre.addPlugin({
		attach: (litreApp) => {
			litreApp.context.set('event_dispatch', shared);
		},
		// begin: (node) => {
		// },
		// prerender: (litreApp) => {
		// },
		update: (litreApp) => {
			shared.dispatchDeferred();
		},
		// postrender: (litreApp) => {
		// },
	});
}

export { initialisePlugin, EventDispatcher, EventListener, shared };
