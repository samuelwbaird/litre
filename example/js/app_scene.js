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

		const add_roll = (roll) => {
			try {
				const parsed_roll = controller.parse_roll(roll);
				const div_roll = this.column2.clone('template_roll', [
					['.txt_roll_hidden', 'value', roll],
					['.txt_roll_label', 'innerText', parsed_roll.name + ':'],
					['.txt_roll_dice', 'innerText', parsed_roll.description],
					['', 'onclick', (e) => {
						alert(roll);
					}],
					['.btn_delete', 'onclick', (e) => {
						e.stopPropagation(); // no click through
						controller.remove_roll(div_roll.node('.txt_roll_hidden').element.value);
						div_roll.remove();
					}],
				]);
			} catch (error) {
				controller.remove_roll(roll);
			}
		};

		this.column1.clone('template_table');
		if (this.show_history) {

		}
		const div_add = this.column2.clone('template_add_roll', [
			['.btn_add', 'onclick', () => {
				const new_roll = div_add.node('.txt_add').element.value;
				try {
					// see if we can successfully parse it or error out
					const parsed_roll = controller.parse_roll(new_roll);
					// add the new roll to the user data
					controller.add_roll(parsed_roll.name +': ' + parsed_roll.description);
					// add the new roll to the layout
					add_roll(new_roll);
					// reset the textbox
					div_add.node('.txt_add').element.value = '';
				} catch (error) {
					alert(error);
				}
			}],
		]);

		for (const roll of this.settings.rolls) {
			add_roll(roll);
		}
	}

	update () {
		super.update();
	}

}

export default app_scene;