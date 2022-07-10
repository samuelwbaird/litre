import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';

let assets_are_loaded = false;

class loading_scene extends app_node {

	begin () {
		super.begin();
	}

	update () {
		super.update();
	}

}

export { loading_scene, assets_are_loaded };