
import { RenderFunctionOptions, ClickFunctionOptions, ClickFunctionResult, Style, RenderFunctionResult } from 'treb-base-types';

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
        case Style.VerticalAlign.Top:
          box.y = offset;
          break;
  
        case Style.VerticalAlign.Middle:
          box.y = Math.round((height - scaled) / 2);
          break;
    
      }
  
      switch (cell.style.horizontal_align) {
        case Style.HorizontalAlign.Right:
          box.x = Math.round(width - offset - scaled);
          break;
  
        case Style.HorizontalAlign.Center:
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

  let x = offset; // Math.round(width / 2 - 8);
  let y = height - offset - 16 * scale; //  Math.round(height / 2 - 8);

  if (cell.style) {
    switch (cell.style.vertical_align) {
      case Style.VerticalAlign.Top:
        y = offset;
        break;

      case Style.VerticalAlign.Middle:
        y = Math.round(height / 2 - 8 * scale);
        break;
  
    }

    switch (cell.style.horizontal_align) {
      case Style.HorizontalAlign.Right:
        x = Math.round(width - offset - 16 * scale);
        break;

      case Style.HorizontalAlign.Center:
        x = Math.round(width / 2 - 8 * scale);
        break;

    }    
  }

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

    const scaled = Math.round(16 * scale);

    const fill = context.fillStyle;
    context.fillStyle = context.strokeStyle;
    context.fillRect(x, y, scaled, scaled);

    context.fillStyle = '#fff';
    context.fillRect(x + 1, y + 1, scaled - 2, scaled - 2);


    // context.lineWidth = Math.max(2, 2 * scale);
    // context.strokeRect(x, y, 16 * scale, 16 * scale);
  }

  return { handled: true }; // painted

};
