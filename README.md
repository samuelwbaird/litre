# litre
A javascript library to drive small stateful apps, spiritual successor to letter-js. 

This library is a successor to adhoc, letter, and letter-js before it, to structure small to medium, stateful applications, like games and mobile web apps, in a logical tree. It targets an opinionated subset of Javascript, mostly favouring ES6 features, with corresponding eslintrc.js file. It is more concerned with objects than classes.

A tree of abstract app\_node _objects_ form the logical layout of application at _runtime_, each node sets scope on resource handling, and order of update 

In previous libraries these logical objects were paired with a related but separate 2D display list object, in this iteration the focus is first on links between these objects and DOM elements, and then secondarily with a pixi.js canvas.

The main ideas informing this new version are:

 * app\_node, with a top level app
 * resource management scoped to each node (all nodes _begin_ and _dispose_)
 * one fixed update timer through the app\_node tree (all nodes _update_)
 * functionality linking nodes with DOM elements
 * functionality related to templating and generation of DOM elements directly from HTML
 * stateless switching of stateful elements
 * decouple 2D graphics and touch handling, using pixi.js as an implementation
 * revisit propagtion of events
 * revisit handling of special case timers and hooks

###Examples
Run a basic web server from the root directory

	python -m SimpleHTTPServer
	python3 -m http.server


#### Dice
Working on a dice roller / live character sheet for a dice pool based TTRPG.

Open http://localhost:8000/example/ in the browser


TODO

 * dom integration, should there be a dom link object or should the dom elements become wrapped (and unwrapped), should it try to transparently wrap using proxy instead of modify? (two identity problem)
 * continue work on dice roller and see if a non-positioned approach works well (position two columns only)
 * check that template spec can set event listeners
 * template update spec for lists (parent, collection, mapping function)
 * tween some nodes
 * maybe when the template populates a list, the parent node should be marked up with methods to help maintain that list (or provide functionality like sort, or drag)
 * app node switch and list state mapping
 * resource loading queries, then image, then ?
 * screen space touch handling

