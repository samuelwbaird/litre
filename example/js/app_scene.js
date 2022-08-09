import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';
import * as controller from './controller.js';

class app_scene extends app_node {

	constructor (game_state) {
		super();
		this.settings = game_state.props.settings;
		this.layout = 'vertical';
	}

	begin () {
		super.begin();
		const app = this.context.get('app');
		const screen = this.wrap('screen');

		// first establish a layout based on the screen size and shape
		if (window.innerWidth > window.innerHeight) {
			app.set_dom_screen(screen, 600, 320);
			// create two columns
			this.column1 = screen.add('div').position((app.dom_screen.width / 2) - 279, 10);
			this.column2 = screen.add('div').position((app.dom_screen.width / 2) + 5, 10);
			this.show_history = true;
		} else {
			app.set_dom_screen(screen, 300, 480);
			// create one column
			this.column1 = this.column2 = screen.add('div').position((app.dom_screen.width - 274) / 2, 10);
		}

		this.column1.clone('template_table');
		if (this.show_history) {

		}
		this.column2.clone('template_add_roll');
	}

	update () {
		super.update();
	}

}

export default app_scene;