import { resource, sequence, state, dom, app_node } from '../../lib/litre/litre.js';
import * as controller from './controller.js';

class app_scene extends app_node {

	constructor (game_state) {
		super();
		this.settings = game_state.props.settings;
		this.layout = 'vertical';
		this.roll_elements = [];
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
			this.history_length = 10;
		} else {
			app.set_dom_screen(screen, 300, 480);
			// create one column
			this.column1 = this.column2 = screen.add('div').position((app.dom_screen.width - 274) / 2, 10);
			this.history_length = 2;
		}

		this.table = this.column1.clone('template_table');
		this.history_parent = this.column1.add('div');

		// allow scroll if we need it
		screen.element.style.overflow = 'auto';

		const add_history = (name, total) => {
			if (!this.history_parent) {
				return;
			}
			while (this.history_parent.element.children.length >= this.history_length) {
				this.history_parent.element.removeChild(this.history_parent.element.lastChild);
			}

			const div_roll_history = this.history_parent.clone('template_roll_history', [
				['.txt_roll_label_history', 'innerText', name + ':'],
				['.txt_roll_result', 'innerText', total],
			]);

			this.history_parent.element.insertBefore(div_roll_history.element, this.history_parent.element.firstChild);
			
			div_roll_history.element.style.opacity = 0;
			this.tween(div_roll_history.element.style, sequence.easing.linear(20), { opacity: 1 });
		};

		const add_roll = (roll, fade_in) => {
			try {
				const parsed_roll = controller.parse_roll(roll);
				const div_roll = this.column2.clone('template_roll', [
					['.txt_roll_hidden', 'value', roll],
					['.txt_roll_label', 'innerText', parsed_roll.name + ':'],
					['.txt_roll_dice', 'innerText', parsed_roll.description],
					['', 'onclick', (e) => {
						this.get_coroutine_manager().clear();
						this.run(this.roll_the_dice, parsed_roll, add_history);
					}],
					['.btn_delete', 'onclick', (e) => {
						e.stopPropagation(); // no click through
						controller.remove_roll(div_roll.node('.txt_roll_hidden').element.value);
						div_roll.remove();
					}],
				]);
			
				if (fade_in) {
					div_roll.element.style.opacity = 0;
					this.tween(div_roll.element.style, sequence.easing.linear(20), { opacity: 1 });
				}
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
					add_roll(new_roll, true);
					// reset the textbox
					div_add.node('.txt_add').element.value = '';
				} catch (error) {
					alert(error);
				}
			}],
		]);

		for (const roll of this.settings.rolls) {
			add_roll(roll, false);
		}
	}

	update () {
		super.update();
	}
	
	*roll_the_dice (parsed_roll, add_history) {
		// clear everything from the previous roll
		this.clear_previous_roll();
		
		// show the name parsed_roll.name on screen
		this.table.update([['.txt_table_title', 'innerText', parsed_roll.name + ': ' + parsed_roll.description]]);
		
		let result = 0;
		let count = parsed_roll.dice.length + parsed_roll.modifiers.length;
		
		let padding = 40;
		let space = (264 - padding) / count;
		let x = (space + padding) * 0.5 - 16;
		
		// roll each dice in the parsed roll
		// then add the set modifiers
		for (const d of parsed_roll.dice) {
			let this_dice = Math.floor((Math.random() * Math.abs(d))) + 1;
			if (d < 0) {
				this_dice = -this_dice;
			}
			const div_roll = this.column1.clone('template_dice_value', [
				['.txt_dice_value', 'innerText', this_dice],
			]);
			
			// let's tween it into place
			div_roll.position(x - 100, 29 - 40);
			for (let i = 0; i <= 35; i++) {
				this.get_frame_dispatch().delay(i, () => {
					div_roll.element.style.transform = 'rotate(' + (Math.random() * 360 * ((35-i)/35)) + 'deg)';
				});
			}
			this.tween(div_roll.element.style, sequence.easing.ease_out(50), {
				left: x, 
			});
			this.tween(div_roll.element.style, sequence.easing.interpolate([0, 1, 0.5, 1, 0.75, 1], 45), {
				top: 29,
			});
			
			
			result += this_dice;
			this.roll_elements.push(div_roll);
			
			// wait between each step
			yield sequence.yield_frames(25);
			x += space;
		}
		
		yield sequence.yield_frames(20);	
		
		for (const m of parsed_roll.modifiers) {
			const div_roll = this.column1.clone('template_modifier_value', [
				['.txt_modifier_value', 'innerText', m],
			]);
			div_roll.position(x, 29);
			result += m;
			this.roll_elements.push(div_roll);
		
			div_roll.element.style.opacity = 0;
			this.tween(div_roll.element.style, sequence.easing.linear(20), {
				opacity: 1,
			});
		
			// wait between each step
			yield sequence.yield_frames(1);
			x += space;
		}
		
		// final pause before showing the total
		this.table.update([['.txt_table_result', 'innerText', result]]);
		
		// add to history
		add_history(parsed_roll.name, result);
	}
	
	clear_previous_roll () {
		this.table.update([
			['.txt_table_title', 'innerText', ''],
			['.txt_table_result', 'innerText', ''],
		]);
		for (const el of this.roll_elements) {
			el.remove();
		}
		this.roll_elements = [];
	}

}

export default app_scene;