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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * generic method for mouse drag handling. this method will insert an
 * event mask to capture mouse events over the whole window, and call
 * optional functions on events.
 *
 * @param classes optional list of classes to attach to the mask node
 * @param move callback function on mouse move events
 * @param end callback function on end (mouse up or button up)
 */
export function MouseDrag(
    mask_node: HTMLElement,
    classes: string|string[] = [],
    move?: (event: MouseEvent) => void,
    end?: (event: MouseEvent) => void) {

  if (typeof classes === 'string') {
    classes = [classes];
  }

  // eslint-disable-next-line prefer-const
  let cleanup: () => void;

  const handle_up = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    cleanup();
    // if (end) end.call(this, event);
    if (end) { end(event); }
  };

  const handle_move = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!event.buttons) {
      cleanup();
      // if (end) end.call(this, event);
      if (end) { end(event); }
      return;
    }
    // if (move) move.call(this, event);
    if (move) { move(event); }
  };

  cleanup = () => {
    mask_node.style.display = 'none';
    mask_node.removeEventListener('mousemove', handle_move);
    mask_node.removeEventListener('mouseup', handle_up);
    for (const class_entry of classes) mask_node.classList.remove(class_entry);
  };

  for (const class_entry of classes) mask_node.classList.add(class_entry);
  mask_node.style.display = 'block';

  // listeners are only added if we're going to use the callbacks.
  // still safe to call remove listener even if they're not added.

  if (move) mask_node.addEventListener('mousemove', handle_move);
  if (end) mask_node.addEventListener('mouseup', handle_up);

}
