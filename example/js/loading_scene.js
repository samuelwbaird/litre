// Copyright 2022 Samuel Baird
import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';
import * as controller from './controller.js';

class loading_scene extends app_node {

	begin () {
		super.begin();
		// associate displaying this element, with this app node
		this.wrap('loading_layer').show(true);

		// pretend we were loading in assets
		this.get_frame_dispatch().delay(30, () => {
			controller.set_assets_are_loaded();
		});
	}

	update () {
		super.update();
	}

}

export default loading_scene;