import { sequence, dom, AppNode } from '../../lib/litre/litre.js';
import * as controller from './controller.js';

class AppScene extends AppNode {

	constructor (settings) {
		super();
		this.settings = settings;
		this.layout = 'vertical';
		this.rollElements = [];
	}

	begin () {
		super.begin();
		const app = this.context.get('app');
		const screen = this.wrap('screen');

		// first establish a layout based on the screen size and shape
		if (window.innerWidth > window.innerHeight) {
			app.setDomScreen(screen, 600, 320);
			// create two columns
			this.column1 = screen.add('div').position((app.domScreen.width / 2) - 279, 10);
			this.column2 = screen.add('div').position((app.domScreen.width / 2) + 5, 10);
			this.historyLength = 10;
		} else {
			app.setDomScreen(screen, 300, 480);
			// create one column
			this.column1 = this.column2 = screen.add('div').position((app.domScreen.width - 274) / 2, 10);
			this.historyLength = 2;
		}

		this.table = this.column1.clone('template_table');
		this.historyParent = this.column1.add('div');

		// allow scroll if we need it
		screen.element.style.overflow = 'auto';

		const addHistory = (name, total) => {
			if (!this.historyParent) {
				return;
			}
			while (this.historyParent.element.children.length >= this.historyLength) {
				this.historyParent.element.removeChild(this.historyParent.element.lastChild);
			}

			const divRollHistory = this.historyParent.clone('template_roll_history', [
				['.txt_roll_label_history', 'innerText', name + ':'],
				['.txt_roll_result', 'innerText', total],
			]);

			this.historyParent.element.insertBefore(divRollHistory.element, this.historyParent.element.firstChild);

			divRollHistory.element.style.opacity = 0;
			this.tween(divRollHistory.element.style, sequence.Easing.linear(20), { opacity: 1 });
		};

		const addRoll = (roll, fadeIn) => {
			try {
				const parsedRoll = controller.parseRoll(roll);
				const divRoll = this.column2.clone('template_roll', [
					['.txt_roll_hidden', 'value', roll],
					['.txt_roll_label', 'innerText', parsedRoll.name + ':'],
					['.txt_roll_dice', 'innerText', parsedRoll.description],
					['', 'onclick', (e) => {
						this.getCoroutineManager().clear();
						this.run(this.rollTheDice, parsedRoll, addHistory);
					}],
					['.btn_delete', 'onclick', (e) => {
						e.stopPropagation(); // no click through
						controller.removeRoll(divRoll.find('.txt_roll_hidden').value);
						divRoll.remove();
					}],
				]);

				if (fadeIn) {
					divRoll.element.style.opacity = 0;
					this.tween(divRoll.element.style, sequence.Easing.linear(20), { opacity: 1 });
				}
			} catch (error) {
				controller.removeRoll(roll);
			}
		};

		for (const previousRoll of this.settings.history) {
			addHistory(previousRoll.name, previousRoll.result);
		}
		const divAdd = this.column2.clone('template_add_roll', [
			['.btn_add', 'onclick', () => {
				const newRoll = divAdd.find('.txt_add').value;
				try {
					// see if we can successfully parse it or error out
					const parsedRoll = controller.parseRoll(newRoll);
					// add the new roll to the user data
					controller.addRoll(parsedRoll.name +': ' + parsedRoll.description);
					// add the new roll to the layout
					addRoll(newRoll, true);
					// reset the textbox
					divAdd.find('.txt_add').value = '';
				} catch (error) {
					alert(error);
				}
			}],
		]);

		for (const roll of this.settings.rolls) {
			addRoll(roll, false);
		}
	}

	update () {
		super.update();
	}

	*rollTheDice (parsedRoll, addHistory) {
		// clear everything from the previous roll
		this.clearPreviousRoll();

		// show the name parsedRoll.name on screen
		this.table.update([['.txt_table_title', 'innerText', parsedRoll.name + ': ' + parsedRoll.description]]);

		let result = 0;
		const count = parsedRoll.dice.length + parsedRoll.modifiers.length;

		const padding = 40;
		const space = (264 - padding) / count;
		let x = (space + padding) * 0.5 - 16;

		// roll each dice in the parsed roll
		// then add the set modifiers
		for (const d of parsedRoll.dice) {
			let thisDice = Math.floor((Math.random() * Math.abs(d))) + 1;
			if (d < 0) {
				thisDice = -thisDice;
			}
			const divRoll = this.column1.clone('template_dice_value', [
				['.txt_dice_value', 'innerText', thisDice],
			]);

			// let's tween it into place
			divRoll.position(x - 100, 29 - 40);
			for (let i = 0; i <= 35; i++) {
				this.getFrameDispatch().delay(i, () => {
					divRoll.element.style.transform = 'rotate(' + (Math.random() * 360 * ((35-i)/35)) + 'deg)';
				});
			}
			this.tween(divRoll.element.style, sequence.Easing.easeOut(50), {
				left: x,
			});
			this.tween(divRoll.element.style, sequence.Easing.interpolate([0, 1, 0.5, 1, 0.75, 1], 45), {
				top: 29,
			});


			result += thisDice;
			this.rollElements.push(divRoll);

			// wait between each step
			yield sequence.yieldFrames(25);
			x += space;
		}

		yield sequence.yieldFrames(20);

		for (const m of parsedRoll.modifiers) {
			const divRoll = this.column1.clone('template_modifier_value', [
				['.txt_modifier_value', 'innerText', m],
			]);
			divRoll.position(x, 29);
			result += m;
			this.rollElements.push(divRoll);

			divRoll.element.style.opacity = 0;
			this.tween(divRoll.element.style, sequence.Easing.linear(20), {
				opacity: 1,
			});

			// wait between each step
			yield sequence.yieldFrames(1);
			x += space;
		}

		// final pause before showing the total
		this.table.update([['.txt_table_result', 'innerText', result]]);

		// add to history
		addHistory(parsedRoll.name, result);
	}

	clearPreviousRoll () {
		this.table.update([
			['.txt_table_title', 'innerText', ''],
			['.txt_table_result', 'innerText', ''],
		]);
		for (const el of this.rollElements) {
			el.remove();
		}
		this.rollElements = [];
	}

}

export default AppScene;
