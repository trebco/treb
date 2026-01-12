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

import type { RenderFunctionOptions, ClickFunctionOptions, ClickFunctionResult, RenderFunctionResult } from 'treb-base-types';

export const ClickCheckbox = (options: ClickFunctionOptions): ClickFunctionResult => {
  const { x, y, width, height, cell } = options;
  const result: ClickFunctionResult = {};

  const offset = 3;
  const scaled = Math.round(16 * (options.scale || 1));

  // console.info('options', options);

  if (cell && width && height && x && y) {

    const box = {
      x: offset,
      y: height - offset - scaled,
    }
  
    if (cell.style) {
      switch (cell.style.vertical_align) {
        case 'top': // Style.VerticalAlign.Top:
          box.y = offset;
          break;
  
        case 'middle': // Style.VerticalAlign.Middle:
          box.y = Math.round((height - scaled) / 2);
          break;
    
      }
  
      switch (cell.style.horizontal_align) {
        case 'right': // Style.HorizontalAlign.Right:
          box.x = Math.round(width - offset - scaled);
          break;
  
        case 'center': // Style.HorizontalAlign.Center:
          box.x = Math.round((width - scaled) / 2);
          break;
  
      }    
    }

    if (x >= box.x && x <= box.x + scaled && y >= box.y && y <= box.y + scaled) {
      result.value = `=Checkbox(${cell.calculated ? 'FALSE' : 'TRUE'})`;
      result.block_selection = true;
    }
  }

  return result;
};

export const RenderCheckbox = (options: RenderFunctionOptions): RenderFunctionResult => {

  const {context, width, height, cell} = options;
  const scale = options.scale || 1;

  context.lineJoin = 'round';
  context.lineCap = 'round';

  const offset = 3 * scale;
  const scaled = 16 * scale;

  let x = offset; 
  let y = height - offset - scaled; 

  if (cell.style) {
    switch (cell.style.vertical_align) {
      case 'top': // Style.VerticalAlign.Top:
        y = offset;
        break;

      case 'middle': // Style.VerticalAlign.Middle:
        y = // Math.round
          ((height - scaled) / 2);
        break;
  
    }

    switch (cell.style.horizontal_align) {
      case 'right': // Style.HorizontalAlign.Right:
        x = // Math.round
          (width - offset - scaled);
        break;

      case 'center': // Style.HorizontalAlign.Center:
        x = // Math.round
          ((width - scaled) / 2);
        break;

    }    
  }

  x = Math.floor(x) + .5;
  y = Math.floor(y) + .5;

  const x2 = Math.floor(x + scaled) + .5;
  const y2 = Math.floor(y + scaled) + .5;

  if (cell && cell.calculated) {
    context.lineWidth = .5;
    context.fillStyle = context.strokeStyle;
    context.beginPath();

    context.moveTo(x, y);
    context.lineTo(x + 16 * scale, y);
    context.lineTo(x + 16 * scale, y + 16 * scale);
    context.lineTo(x, y + 16 * scale);
    context.closePath();

    context.moveTo(x + 15 * scale, y + 4 * scale);
    for (const point of [
        [13.59, 2.58],
        [6, 10.17],
        [2.41, 6.59],
        [1, 8],
        [6, 13],
      ]) {
      context.lineTo(x + point[0] * scale, y + point[1] * scale);
    }
    context.closePath();
    context.fill();

  }
  else {

    context.lineWidth = 1;
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x2, y);
    context.lineTo(x2, y2);
    context.lineTo(x, y2);
    context.closePath();
    context.stroke();

    // context.lineWidth = Math.max(2, 2 * scale);
    // context.strokeRect(x, y, 16 * scale, 16 * scale);
  }

  return { handled: true }; // painted

};
