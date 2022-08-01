import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';
import * as controller from './controller.js';

class app_scene extends app_node {

	constructor (game_state) {
		super();
		this.settings = game_state.props.settings;
	}

	begin () {
		super.begin();
		// first establish a layout based on the screen size and shape
		
	}

	update () {
		super.update();
	}

}

export default app_scene;