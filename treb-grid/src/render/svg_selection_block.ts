
import { Theme, Rectangle } from 'treb-base-types';

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
  public fill?: SVGElement; // SVGPathElement;
  public nub?: SVGRectElement;

  constructor( primary: boolean,
               private theme: Theme,
               private offset: SelectionOffset = {x: 0, y: 0}) {

    this.g = document.createElementNS(SVGNS, 'g');
    this.g.setAttribute('transform', `translate(${offset.x}, ${offset.y})`);
    
    this.outline = document.createElementNS(SVGNS, 'rect');
    this.outline.setAttribute('class', 'outline');

    if (primary) {

      this.g.setAttribute('class', 'selection primary-selection');

      // primary selections have a separate fill, plus the nub. separate
      // fill because the "target" is unfilled.

      this.fill = document.createElementNS(SVGNS, 'path');
      this.fill.setAttribute('class', 'fill');

      this.nub = document.createElementNS(SVGNS, 'rect');
      this.nub.setAttribute('class', 'nub');

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

      this.fill = document.createElementNS(SVGNS, 'rect');
      this.fill.setAttribute('class', 'fill');

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