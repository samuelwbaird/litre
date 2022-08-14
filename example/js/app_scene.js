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
			this.column1.clone('template_table');
			this.history_parent = this.column1.add('div');
		} else {
			app.set_dom_screen(screen, 300, 480);
			// create one column
			this.column1 = this.column2 = screen.add('div').position((app.dom_screen.width - 274) / 2, 10);
			this.column1.clone('template_table');
		}

		// allow scroll if we need it
		screen.element.style.overflow = 'auto';
		
		const add_history = (name, total) => {
			if (!this.history_parent) {
				return;
			}
			while (this.history_parent.element.children.length > 10) {
				this.history_parent.element.removeChild(this.history_parent.element.lastChild);
			}
			
			const div_roll_history = this.history_parent.clone('template_roll_history', [
				['.txt_roll_label_history', 'innerText', name + ':'],
				['.txt_roll_result', 'innerText', total],
			]);

			this.history_parent.element.insertBefore(div_roll_history.element, this.history_parent.element.firstChild);
		}

		const add_roll = (roll) => {
			try {
				const parsed_roll = controller.parse_roll(roll);
				const div_roll = this.column2.clone('template_roll', [
					['.txt_roll_hidden', 'value', roll],
					['.txt_roll_label', 'innerText', parsed_roll.name + ':'],
					['.txt_roll_dice', 'innerText', parsed_roll.description],
					['', 'onclick', (e) => {
						const result = Math.floor(Math.random() * 20 + 1);
						add_history(parsed_roll.name, result);
						controller.add_to_history(parsed_roll.name, result);
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

		for (const previous_roll of this.settings.history) {
			add_history(previous_roll.name, previous_roll.result);
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