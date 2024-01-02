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
 * So here is how Excel column widths work:
 * 
 * Column width, as used in the <col/> elements, is
 * 
 * "
 * ...measured as the number of characters of the maximum digit width of the 
 * numbers 0, 1, 2, ..., 9 as rendered in the normal style's font. There are 
 * 4 pixels of margin padding (two on each side), plus 1 pixel padding for the 
 * gridlines.
 * "
 * 
 * https://c-rex.net/projects/samples/ooxml/e1/Part4/OOXML_P4_DOCX_col_topic_ID0ELFQ4.html
 * 
 * (good resource, btw)
 * 
 * 
 * ==== THIS IS COMPLETELY FUCKING INSANE ======================================
 * 
 * Using the Calibri font as an example, the maximum digit width of 11 point 
 * font size is 7 pixels (at 96 dpi). In fact, each digit is the same width for 
 * this font. Therefore if the cell width is 8 characters wide, the value of 
 * this attribute shall be Truncate([8*7+5]/7*256)/256 = 8.7109375.
 *
 * To translate the value of width in the file into the column width value at 
 * runtime (expressed in terms of pixels), use this calculation:
 *
 * =Truncate(((256 * {width} + Truncate(128/{Maximum Digit Width}))/256)*{Maximum Digit Width})
 * 
 * Using the same example as above, the calculation would be 
 * Truncate(((256*8.7109375+Truncate(128/7))/256)*7) = 61 pixels
 *
 * To translate from pixels to character width, use this calculation:
 *
 * =Truncate(({pixels}-5)/{Maximum Digit Width} * 100+0.5)/100
 * 
 * Using the example above, the calculation would be 
 * Truncate((61-5)/7*100+0.5)/100 = 8 characters.
 * 
 * =============================================================================
 * 
 * Reading the above, if you want the cell to be *8 characters wide* the value
 * of the attribute shall be *8.7109375*. 
 * 
 * Step 3: Profit!
 * 
 */

const MaximumDigitWidth = 7; // @ calibri 11

export const PixelsToColumnWidth = (pixels: number): number => {
  const characters = Math.floor((pixels - 5) / MaximumDigitWidth * 100 + 0.5) / 100;
  const column_width = Math.floor((characters * MaximumDigitWidth + 5) / MaximumDigitWidth * 256) / 256;

  // console.info('pixels', pixels, 'characters', characters, 'width', column_width);

  return column_width;
};

export const ColumnWidthToPixels = (width: number): number => {
  const pixels = Math.floor(((256 * width + Math.floor(128 / MaximumDigitWidth)) / 256) * MaximumDigitWidth);
  // console.info('width', width, 'pixels', pixels);
  return pixels;
};
