/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * new mouse drag event uses setPointerCapture, should be cleaner and 
 * more consistent in different layouts. before we use this we need to
 * understand how it interacts with pinch events though, I think there's 
 * a css style we could use
 * 
 * touch-action: none;
 * 
 */
export function MouseDrag(
    trigger_event: PointerEvent,
    classes: string[] = [],
    move?: (event: PointerEvent) => void,
    end?: (event: PointerEvent) => void) {

  const target = trigger_event.target;

  if (!(target instanceof HTMLElement)) {
    console.warn('no event target');
    return;
  }

  function Cleanup(event: PointerEvent) {
    if (target instanceof HTMLElement) {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener('pointermove', HandleMove);
      target.removeEventListener('pointerup', HandleUp);
    }
  }

  function HandleUp(event: PointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    Cleanup(event);
    if (end) {
      end(event);
    }
  };

  function HandleMove(event: PointerEvent) {
    event.stopPropagation();
    event.preventDefault();

    if (!event.buttons) {
      HandleUp(event);
    }
    else if (move) { 
      move(event);
    }

  }

  target.setPointerCapture(trigger_event.pointerId);
  target.addEventListener('pointermove', HandleMove);
  target.addEventListener('pointerup', HandleUp);

  // TODO: classes

}
