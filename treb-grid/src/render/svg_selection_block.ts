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

import { type Theme, type Rectangle, DOMContext } from 'treb-base-types';

/**
 * the original selections -- a canvas overlaid over the tile canvases --
 * broke android chrome, hard. so we are switching to an svg overlay (seems
 * ok on android chrome, at least for now).
 *
 * this class wraps up some of the svg-specific stuff, particularly setting
 * attributes.
 */

export interface SelectionOffset {
  x: number;
  y: number;
}

export class SVGSelectionBlock {

  public g: SVGGElement;
  public outline: SVGRectElement;
  public fill?: SVGElement; // SVGPathElement;
  public nub?: SVGRectElement;

  constructor( primary: boolean,
               private theme: Theme,
               private offset: SelectionOffset = {x: 0, y: 0},
               node: SVGElement) {

    const DOM = DOMContext.GetInstance(node.ownerDocument);

    this.g = DOM.SVG('g');
    this.g.setAttribute('transform', `translate(${offset.x}, ${offset.y})`);
    
    this.outline = DOM.SVG('rect', 'outline');

    if (primary) {

      this.g.setAttribute('class', 'selection primary-selection');

      // primary selections have a separate fill, plus the nub. separate
      // fill because the "target" is unfilled.

      this.fill = DOM.SVG('path', 'fill');
      this.nub = DOM.SVG('rect', 'nub');

      this.g.appendChild(this.fill);
      this.g.appendChild(this.outline);
      this.g.appendChild(this.nub);

    }
    else {
      this.g.setAttribute('class', 'selection alternate-selection');

      // secondary selections. fill is not used, we just fill the rect

      // UPDATE: adding the fill, for styling purposes; we can set color,
      // and use currentColor, but we can't set opacity separately so we
      // need another node. which is a waste, but ergonomics ftw!

      this.fill = DOM.SVG('rect', 'fill');

      // this.SetThemeColor(0);
      // if (theme.additional_selection_line_dash_array) {
      //  this.outline.setAttribute('stroke-dasharray', theme.additional_selection_line_dash_array);
      // }

      this.g.appendChild(this.fill);
      this.g.appendChild(this.outline);

    }
  }

  public Offset(offset: SelectionOffset): void {
    this.g.setAttribute('transform', `translate(${offset.x}, ${offset.y})`);
  }

  /*
  public SetThemeColor(index = 0) {

    if (Array.isArray(this.theme.additional_selection_color)) {
      if (index >= this.theme.additional_selection_color.length) {
        index = index % this.theme.additional_selection_color.length;
      }
    }

    if (this.theme.additional_selection_overlay_color) {
      if (typeof this.theme.additional_selection_overlay_color === 'string') {
        this.outline.setAttribute('fill', this.theme.additional_selection_overlay_color);
      }
      else {
        this.outline.setAttribute('fill', this.theme.additional_selection_overlay_color[index] || '');
      }
    }
    else {
      this.outline.setAttribute('fill', '');
    }

    if (this.theme.additional_selection_color) {
      if (typeof this.theme.additional_selection_color === 'string') {
        this.outline.setAttribute('stroke', this.theme.additional_selection_color);
      }
      else {
        this.outline.setAttribute('stroke', this.theme.additional_selection_color[index] || '');
      }
    }
    else {
      this.outline.setAttribute('stroke', '');
    }

  }
  */

  public Show(show = true) {
    this.g.style.display = show ? 'block' : 'none';
  }

  public SetOutline(rect: Rectangle, fill = false): void {
    this.outline.setAttribute('x', (rect.left - 1).toString());
    this.outline.setAttribute('y', (rect.top - 1).toString());
    this.outline.setAttribute('width', (rect.width + 1).toString());
    this.outline.setAttribute('height', (rect.height + 1).toString());

    if (fill && this.fill) {
      this.fill.setAttribute('x', (rect.left).toString());
      this.fill.setAttribute('y', (rect.top).toString());
      this.fill.setAttribute('width', (rect.width).toString());
      this.fill.setAttribute('height', (rect.height).toString());
    }

  }

  public SetFill(inside: Rectangle, outside: Rectangle) {
    if (!this.fill) return;

    const d: string[] = [];

    // inner
    d.push('M' + inside.left + ' ' + inside.top);
    d.push('L' + inside.left + ' ' + inside.bottom);
    d.push('L' + inside.right + ' ' + inside.bottom);
    d.push('L' + inside.right + ' ' + inside.top);
    d.push('Z');

    // outer, reverse direction
    d.push('M' + outside.left + ' ' + outside.top);
    d.push('L' + outside.right + ' ' + outside.top);
    d.push('L' + outside.right + ' ' + outside.bottom);
    d.push('L' + outside.left + ' ' + outside.bottom);
    d.push('Z');

    this.fill.setAttribute('d', d.join(' '));
  }

  public SetNub(rect: Rectangle) {
    if (!this.nub) return;
    this.nub.setAttribute('x', (rect.left + rect.width - 4).toString());
    this.nub.setAttribute('y', (rect.top + rect.height - 4).toString());
    this.nub.setAttribute('width', '7');
    this.nub.setAttribute('height', '7');
  }

}
