
import { RenderFunctionOptions, ClickFunctionOptions, ClickFunctionResult } from 'treb-base-types';

export const ClickCheckbox = (options: ClickFunctionOptions): ClickFunctionResult => {
  const { x, y, width, height, cell } = options;
  const result: ClickFunctionResult = {};

  if (cell && width && height && x && y) {
    const box = {
      x: Math.round(width / 2 - 8),
      y: Math.round(height / 2 - 8),
    };

    if (x >= box.x && x <= box.x + 16 && y >= box.y && y <= box.y + 16) {
      result.value = `=Checkbox(${cell.calculated ? 'FALSE' : 'TRUE'})`;
      result.block_selection = true;
    }
  }

  return result;
};

export const RenderCheckbox = (options: RenderFunctionOptions): void => {

  const {context, width, height, cell} = options;

  context.lineJoin = 'round';
  context.lineCap = 'round';

  const x = Math.round(width / 2 - 8);
  const y = Math.round(height / 2 - 8);

  if (cell && cell.calculated) {
    context.lineWidth = .5;
    context.fillStyle = context.strokeStyle;
    context.beginPath();

    context.moveTo(x, y);
    context.lineTo(x + 16, y);
    context.lineTo(x + 16, y + 16);
    context.lineTo(x, y + 16);
    context.closePath();

    context.moveTo(x + 15, y + 4);
    for (const point of [
        [13.59, 2.58],
        [6, 10.17],
        [2.41, 6.59],
        [1, 8],
        [6, 13],
      ]) {
      context.lineTo(x + point[0], y + point[1]);
    }
    context.closePath();
    context.fill();

  }
  else {
    context.lineWidth = 2;
    context.strokeRect(x, y, 16, 16);
  }

};
