
import { Rectangle } from 'treb-base-types';

import { ExtendedTheme } from '../types/theme';

/**
 * the original selections -- a canvas overlaid over the tile canvases --
 * broke android chrome, hard. so we are switching to an svg overlay (seems
 * ok on android chrome, at least for now).
 *
 * this class wraps up some of the svg-specific stuff, particularly setting
 * attributes.
 */

const SVGNS = 'http://www.w3.org/2000/svg';

export interface SelectionOffset {
  x: number;
  y: number;
}

export class SVGSelectionBlock {

  public g: SVGGElement;
  public outline: SVGRectElement;
  public fill?: SVGPathElement;
  public nub?: SVGRectElement;

  constructor( primary: boolean,
               private theme: ExtendedTheme,
               private offset: SelectionOffset = {x: 0, y: 0}) {

    this.g = document.createElementNS(SVGNS, 'g');
    this.g.setAttribute('transform', `translate(${offset.x}, ${offset.y})`);
    this.outline = document.createElementNS(SVGNS, 'rect');
    this.outline.setAttribute('stroke-width', '2');

    if (primary) {

      // primary selections have a separate fill, plus the nub

      this.outline.setAttribute('fill', 'none');
      this.outline.setAttribute('stroke', theme.primary_selection_color || '');

      if (theme.primary_selection_line_dash_array) {
        this.outline.setAttribute('stroke-dasharray', theme.primary_selection_line_dash_array);
      }

      this.fill = document.createElementNS(SVGNS, 'path');
      this.fill.setAttribute('stroke', 'none');
      this.fill.setAttribute('fill', theme.primary_selection_overlay_color || '');

      this.nub = document.createElementNS(SVGNS, 'rect');
      this.nub.setAttribute('fill', theme.primary_selection_color || '');
      this.nub.setAttribute('stroke', '#fff');
      this.nub.setAttribute('stroke-width', '1');

      this.g.appendChild(this.fill);
      this.g.appendChild(this.outline);
      this.g.appendChild(this.nub);

    }
    else {

      // secondary selections. fill is not used, we just fill the rect

      this.SetThemeColor(0);
      if (theme.additional_selection_line_dash_array) {
        this.outline.setAttribute('stroke-dasharray', theme.additional_selection_line_dash_array);
      }
      this.g.appendChild(this.outline);

    }
  }

  public Offset(offset: SelectionOffset) {
    this.g.setAttribute('transform', `translate(${offset.x}, ${offset.y})`);
  }

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

  public Show(show = true) {
    this.g.style.display = show ? 'block' : 'none';
  }

  public SetOutline(rect: Rectangle) {
    this.outline.setAttribute('x', (rect.left - 1).toString());
    this.outline.setAttribute('y', (rect.top - 1).toString());
    this.outline.setAttribute('width', (rect.width + 1).toString());
    this.outline.setAttribute('height', (rect.height + 1).toString());
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
