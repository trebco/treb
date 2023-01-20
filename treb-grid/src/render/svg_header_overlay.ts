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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import type { Theme } from 'treb-base-types';

const SVGNS = 'http://www.w3.org/2000/svg';

export enum Orientation {
  Horizontal,
  Vertical,
}

export class HeaderOverlay {

  private g: SVGGElement;
  private overlay: SVGRectElement;
  private highlight: SVGRectElement;

  constructor(
      private theme: Theme,
      private container: SVGElement,
      private orientation: Orientation) {

    this.g = document.createElementNS(SVGNS, 'g');
    this.g.setAttribute('class', 'header-overlay');

    this.overlay = document.createElementNS(SVGNS, 'rect');
    this.overlay.setAttribute('class', 'overlay');

    this.highlight = document.createElementNS(SVGNS, 'rect');
    this.highlight.setAttribute('class', 'highlight');

    this.g.style.display = 'none';
    this.g.appendChild(this.highlight);
    this.g.appendChild(this.overlay);

    container.appendChild(this.g);

  }

  /**
   * remove from DOM, prior to cleanup
   */
  public Remove() {
    this.container.removeChild(this.g);
  }

  public Hide() {
    this.g.style.display = 'none';
  }

  public Show(x: number, y: number, width: number, height: number){

    this.overlay.setAttribute('x', x.toString());
    this.overlay.setAttribute('y', y.toString());
    this.overlay.setAttribute('width', width.toString());
    this.overlay.setAttribute('height', height.toString());

    if (this.orientation === Orientation.Horizontal) {
      this.highlight.setAttribute('x', x.toString());
      this.highlight.setAttribute('y', (y + height - 2).toString());
      this.highlight.setAttribute('width', width.toString());
      this.highlight.setAttribute('height', '2');
    }
    else {
      this.highlight.setAttribute('x', (x + width - 2).toString());
      this.highlight.setAttribute('y', y.toString());
      this.highlight.setAttribute('width', '2');
      this.highlight.setAttribute('height', height.toString());
    }

    this.g.style.display = 'block';
  }

}
