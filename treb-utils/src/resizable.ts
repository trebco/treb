/**
 * 
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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * support for resizable node, drag handle, drag rect, mask
 * FIXME: make this composable (decorator?)
 * FIXME: make this generic, we can use it for some other stuff (charts?)
 */
export class Resizable {

  private static resize_mask: HTMLElement;
  private static resize_rect: HTMLElement;

  /**
   * adding layout_reference to move the handle. to keep this backwards
   * compatible, we add it as a last, optional parameter. at some point
   * we can create a replacement class and migrate.
   * 
   * this is a weird pattern, we don't need an instance of this class...
   * goint to refactor
   * 
   */
  constructor(container: HTMLElement, node: HTMLElement, resize_callback: () => void,
      layout_reference: HTMLElement = container) {

    Resizable.Create({
      container, 
      node, 
      resize_callback, 
      layout_reference});

  }

  public static Create(options: {
      container: HTMLElement; 
      node: HTMLElement;
      resize_callback?: () => void;
      layout_reference?: HTMLElement;
   }): void {

    const resize_handle = document.createElement('div');
    resize_handle.classList.add('treb-embed-resize-handle');

    (options.layout_reference || options.container).appendChild(resize_handle);

    if (!Resizable.resize_mask) {
      let mask = document.querySelector('.treb-embed-mouse-mask');
      if (!mask) {
        mask = document.createElement('div');
        mask.classList.add('treb-embed-mouse-mask');
        document.body.appendChild(mask);
      }
      Resizable.resize_mask = mask as HTMLElement;
    }

    if (!Resizable.resize_rect) {
      let rect = document.querySelector('.treb-embed-resize-rect');
      if (!rect) {
        rect = document.createElement('div');
        rect.classList.add('treb-embed-resize-rect');
        Resizable.resize_mask.appendChild(rect);
      }
      Resizable.resize_rect = rect as HTMLElement;
    }

    // eslint-disable-next-line prefer-const
    let mouseup: () => void;
    
    // eslint-disable-next-line prefer-const
    let mousemove: (event: MouseEvent) => void;

    let container_rect = { width: 0, height: 0 };
    let offset = { x: 0, y: 0 };
    let delta = { x: 0, y: 0 };

    const cleanup = () => {

      Resizable.resize_mask.removeEventListener('mousemove', mousemove);
      Resizable.resize_mask.removeEventListener('mouseup', mouseup);
      Resizable.resize_mask.style.display = 'none';

      if (delta.x || delta.y) {
        const bounding_rect = options.container.getBoundingClientRect();
        const width = bounding_rect.width + delta.x;
        const height = bounding_rect.height + delta.y;
        options.container.style.width = `${width}px`;
        options.container.style.height = `${height}px`;
        if (options.resize_callback) {
          options.resize_callback();
        }
      }

    };

    mousemove = (event: MouseEvent) => {

      if (!event.buttons) {
        cleanup();
        return;
      }

      if (delta.x !== event.clientX - offset.x) {
        delta.x = event.clientX - offset.x;
        Resizable.resize_rect.style.width = `${container_rect.width + delta.x + 4}px`;
      }
      if (delta.y !== event.clientY - offset.y) {
        delta.y = event.clientY - offset.y;
        Resizable.resize_rect.style.height = `${container_rect.height + delta.y + 4}px`;
      }
    };

    mouseup = () => {
      cleanup();
    };

    resize_handle.addEventListener('mousedown', (event) => {

      event.stopPropagation();
      event.preventDefault();

      const bounding_rect = options.node.getBoundingClientRect();
      container_rect = { width: bounding_rect.width, height: bounding_rect.height };

      if (Resizable.resize_rect) {
        Resizable.resize_rect.style.top = `${bounding_rect.top - 2}px`;
        Resizable.resize_rect.style.left = `${bounding_rect.left - 2}px`;
        Resizable.resize_rect.style.width = `${bounding_rect.width + 4}px`;
        Resizable.resize_rect.style.height = `${bounding_rect.height + 4}px`;
      }

      offset = { x: event.clientX, y: event.clientY };
      delta = { x: 0, y: 0 };

      Resizable.resize_mask.style.display = 'block';
      Resizable.resize_mask.addEventListener('mousemove', mousemove);
      Resizable.resize_mask.addEventListener('mouseup', mouseup);

    });

  }

}
