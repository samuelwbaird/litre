// add touch area, scroll and buttons to litre_pixi
// copyright 2023 Samuel Baird MIT Licence

import * as litre from '../litre.js';
import * as event_dispatch from './event_dispatch.js';

export const EVENT_TOUCH_BEGIN = 'EVENT_TOUCH_BEGIN';
export const EVENT_TOUCH_MOVE = 'EVENT_TOUCH_MOVE';
export const EVENT_TOUCH_CANCEL = 'EVENT_TOUCH_CANCEL';
export const EVENT_TOUCH_END = 'EVENT_TOUCH_END';

export let CONFIG_BUTTON_TOUCH_OUTER_PADDING = 10;
export let CONFIG_BUTTON_ACTION_DELAY = 2;

class TouchArea {

	constructor (pointConversion, areaTest, dispatcher) {
		this.pointConversion = pointConversion;
		this.areaTest = areaTest;

		// receive incoming touch from the DOM
		this.listenBegin = new event_dispatch.EventListener(EVENT_TOUCH_BEGIN, (touchData) => {
			this.handleTouchBegin(touchData);
		}, dispatcher);
		this.listenMove = new event_dispatch.EventListener(EVENT_TOUCH_MOVE, (touchData) => {
			this.handleTouchMove(touchData);
		}, dispatcher);
		this.listenCancel = new event_dispatch.EventListener(EVENT_TOUCH_CANCEL, (touchData) => {
			this.handleTouchCancel(touchData);
		}, dispatcher);
		this.listenEnd = new event_dispatch.EventListener(EVENT_TOUCH_END, (touchData) => {
			this.handleTouchEnd(touchData);
		}, dispatcher);

		// initialise values
		this.cancelTouch();

		// clients should supply these
		this.onTouchBegin = null;
		this.onTouchMove = null;
		this.onTouchEnd = null;
		this.onTouchCancel = null;
	}

	cancelTouch () {
		if (this.isTouched) {
			this.isTouched = false;
			if (this.onTouchCancel) {
				this.onTouchCancel(this);
			}
		}

		this.isTouched = false;
		this.isTouchOver = false;
		this.touchID = null;

		this.touchTime = null;
		this.touchPosition = null;

		this.touchStartTime = null;
		this.touchStartPosition = null;

		this.dragDistance = null;
		this.moveDistance = null;
	}

	get enabled () {
		return this.listenBegin.enabled;
	}

	set enabled (value) {
		if (value && !this.listenBegin.enabled) {
			this.listenBegin.enabled = true;
			this.listenMove.enabled = true;
			this.listenCancel.enabled = true;
			this.listenEnd.enabled = true;
		} else if (!value && this.listenBegin.enabled) {
			this.listenBegin.enabled = false;
			this.listenMove.enabled = false;
			this.listenCancel.enabled = false;
			this.listenEnd.enabled = false;
			this.cancelTouch();
		}
	}

	handleTouchBegin (touchData) {
		if (this.touchID) {
			// already tracking a touch
			return;
		}
		if (!this.pointConversion) {
			// no longer valid
			return;
		}

		const point = this.pointConversion(touchData);
		const isTouchOver = this.areaTest(point);

		if (!isTouchOver) {
			return;
		}

		// -- TODO: check for filtering and intercepts here
		this.isTouched = true;
		this.isTouchOver = true;
		this.touchID = touchData.id;

		this.touchPosition = point;
		this.touchTime = touchData.time;

		this.touchStartPosition = { x : point.x, y : point.y };
		this.touchStartTime = this.touchTime;

		this.dragDistance = null;
		this.moveDistance = null;

		if (this.onTouchBegin) {
			this.onTouchBegin(this);
		}
	}

	handleTouchMove (touchData) {
		if (this.touchID != touchData.id) {
			return;
		}

		this.updateValues(this.pointConversion(touchData), touchData.time);
		if (this.onTouchMove) {
			this.onTouchMove(this);
		}
	}

	handleTouchEnd (touchData) {
		if (this.touchID != touchData.id) {
			return;
		}

		this.updateValues(this.pointConversion(touchData), touchData.time);
		this.isTouched = false;
		if (this.onTouchEnd) {
			this.onTouchEnd(this);
		}
		this.cancelTouch();
	}

	handleTouchCancel (touchData) {
		if (this.touchID != touchData.id) {
			return;
		}
		this.cancelTouch();
	}

	updateValues (point, time) {
		const previousPosition = this.touchPosition;
		this.isTouchOver = this.areaTest(point);
		this.touchPosition = point;
		this.touchTime = time;

		this.dragDistance = { x : point.x - this.touchStartPosition.x, y : point.y - this.touchStartPosition.y };
		this.moveDistance = { x : point.x - previousPosition.x, y : point.y - previousPosition.y };
	}

	dispose () {
		if (this.listenBegin) {
			this.listenBegin.dispose();
			this.listenMove.dispose();
			this.listenCancel.dispose();
			this.listenEnd.dispose();
			this.listenBegin = null;
			this.listenMove = null;
			this.listenCancel = null;
			this.listenEnd = null;
		}
		this.onTouchBegin = null;
		this.onTouchMove = null;
		this.onTouchEnd = null;
	}

}


class Button {

	constructor (target, touchArea, frameDispatch, action) {
		this.target = target;
		this.touchArea = touchArea;
		this.frameDispatch = frameDispatch;
		this.action = action;

		this.isDown = false;
		this.isReleasing = false;
		this.update(true);

		// set up interaction
		this.touchArea.onTouchBegin = () => { this.update(); };
		this.touchArea.onTouchMove = () => { this.update(); };
		this.touchArea.onTouchEnd = () => { this.handleButtonRelease(); };
		this.touchArea.onTouchCancel = () => { this.cancelTouch(); };
	}

	get enabled () {
		return this.touchArea && this.touchArea.enabled;
	}

	set enabled (value) {
		if (this.touchArea) {
			this.touchArea.enabled = value;
		}
		this.update();
	}

	isVisible () {
		return this.target.worldVisible;
	}

	update (force) {
		let active = this.enabled && this.isVisible && this.touchArea.isTouched && !this.isReleasing;
		if (active) {
			const rect = this.target.getLocalBounds();
			rect.pad(CONFIG_BUTTON_TOUCH_OUTER_PADDING);
			if (!rect.contains(this.touchArea.touchPosition.x, this.touchArea.touchPosition.y)) {
				active = false;
			}
		}

		if (active) {
			if (!this.isDown || force) {
				this.isDown = true;
				if (this.target.up) {
					this.target.up.visible = false;
				}
				if (this.target.down) {
					this.target.down.visible = true;
				}
				// TODO: add support for 2 frame animations
				// TODO: add support for touch down/up actions and sounds
			}
		} else {
			if (this.isDown || force) {
				this.isDown = false;
				if (this.target.up) {
					this.target.up.visible = true;
				}
				if (this.target.down) {
					this.target.down.visible = false;
				}
				// TODO: add support for 2 frame animations
				// TODO: add support for touch down/up actions and sounds
			}
		}
	}

	handleButtonRelease () {
		if (this.isReleasing) {
			return;
		}

		if (this.isDown) {
			this.isReleasing = true;
			this.update();
			this.frameDispatch.delay(CONFIG_BUTTON_ACTION_DELAY, () => {
				this.action?.();
				this.isReleasing = false;
			});
		}
	}

	cancelTouch () {
		if (this.isReleasing) {
			return;
		}

		if (this.touchArea) {
			this.touchArea.cancelTouch();
		}
		this.update();
	}

	dispose () {
		if (this.touchArea) {
			this.touchArea.dispose();
			this.touchArea = null;
		}
		this.target = null;
		this.frameDispatch = null;
		this.action = null;
	}
}

class ScrollBehaviour {
	/*

	constructor (touchArea, viewWidth, viewHeight, scrollParent) {
		this.touchArea = touchArea;
		this.viewWidth = viewWidth;
		this.viewHeight = viewHeight;
		this.scrollParent = scrollParent;

		this.contentX = 0;
		this.contentY = 0;
		this.momentumX = 0;
		this.momentumY = 0;

		this.damping = 0.95;
		this.stretch = 0.1;
		this.snap = 0.5;

		this.setContentSize(viewWidth, viewHeight);

		this.touchArea.onTouchMove = (ta) => {
			if (ta.isTouched) {
				if (this.scrollX) {
					const maxX = (this.contentWidth - this.viewWidth);
					if (this.contentX < 0 && ta.moveDistance.x > 0) {
						this.contentX -= ta.moveDistance.x * this.stretch;
					} else if (this.contentX > maxX && ta.moveDistance.x < 0) {
						this.contentX -= ta.moveDistance.x * this.stretch;
					} else {
						this.contentX -= ta.moveDistance.x;
					}

					this.momentumX = -ta.moveDistance.x;
				}
				if (this.scrollY) {
					const maxY = (this.contentHeight - this.viewHeight);
					if (this.contentY < 0 && ta.moveDistance.y > 0) {
						this.contentY -= ta.moveDistance.y * this.stretch;
					} else if (this.contentY > maxY && ta.moveDistance.y < 0) {
						this.contentY -= ta.moveDistance.y * this.stretch;
					} else {
						this.contentY -= ta.moveDistance.y;
					}

					this.momentumY = -ta.moveDistance.y;
				}
			}
		};

	}

	setContentSize (width, height) {
		this.contentWidth = width;
		this.contentHeight = height;
		this.scrollX = (this.contentWidth > this.viewWidth);
		this.scrollY = (this.contentHeight > this.viewHeight);
	}

	setPosition (x, y) {
		this.contentX = x;
		this.contentY = y;
		this.momentumX = 0;
		this.momentumY = 0;
		this.touchArea.cancelTouch();
	}

	update () {
		// bounce back in when not touched
		if (!this.touchArea.isTouched) {
			if (this.scrollX) {
				this.contentX += this.momentumX;

				const maxX = (this.contentWidth - this.viewWidth);
				if (this.contentX < 0) {
					this.contentX *= this.snap;
				} else if (this.contentX > maxX) {
					this.contentX = maxX + (this.contentX - maxX) * this.snap;
				}
			}
			if (this.scrollY) {
				this.contentY += this.momentumY;

				const maxY = (this.contentHeight - this.viewHeight);
				if (this.contentY < 0) {
					this.contentY *= this.snap;
				} else if (this.contentY > maxY) {
					this.contentY = maxY + (this.contentY - maxY) * this.snap;
				}
			}
		}

		this.momentumX *= this.damping;
		this.momentumY *= this.damping;

		// update scroll parent if we have it
		if (this.scrollParent != null) {
			this.scrollParent.x = -this.contentX;
			this.scrollParent.y = -this.contentY;
		}
	}

	dispose () {

	}

	*/
}

export { TouchArea, Button, ScrollBehaviour };
