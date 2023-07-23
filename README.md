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

### Examples
Run a basic web server from the root directory, and then view the /examples/ subfolder in browser.

	python -m SimpleHTTPServer
	python3 -m http.server


#### Dice
Example project is a generic dice roller, allowing you to specify and trigger preconfigured dice rolls, eg. 2D6+4


Open http://localhost:8000/example/ in the browser

#### Swipe Together
Combining litre, with a brogue/lua based backend, create a list of anything you need to choose, then share it with as many people as you need to find consensus with a "Tinder" style swipe interface.


View live at <https://tinywideopenspaces.com/swipetogether/>


DONE

 * created plugin system, and included pixijs integration via a plugin
 * transparent wrapped dom integration
 * migrate to JS standards camel casing
 * DOM template and update spec
 * tween, coroutine, and delay integration

TODO

 * reconsider state transition ideas (referring to template update, and pixiview create)
 * template update spec for lists (parent, collection, mapping function)

