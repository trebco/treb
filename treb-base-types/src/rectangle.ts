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

/** structure represents rectangle coordinates */
export interface IRectangle {
  top: number;
  left: number;
  width: number;
  height: number;  
}

export class Rectangle implements IRectangle {

  public get right(): number { return this.left + this.width; }
  public get bottom(): number { return this.top + this.height; }

  /**
   * create a rectangle from an object that looks 
   * like a rectangle, probably a serialized object
   */
  public static Create(obj: Partial<Rectangle>): Rectangle {
    return new Rectangle(
      obj.left || 0,
      obj.top || 0,
      obj.width || 0,
      obj.height || 0);
  }

  public static IsRectangle(obj: unknown): obj is IRectangle {
    return (typeof obj === 'object') &&
      (typeof (obj as any)?.left === 'number') && 
      (typeof (obj as any)?.top === 'number') && 
      (typeof (obj as any)?.width === 'number') && 
      (typeof (obj as any)?.height === 'number');
  }

  constructor(  public left = 0,
                public top = 0,
                public width = 0,
                public height = 0 ){}

  /** returns a new rect shifted from this one by (x,y) */
  public Shift(x = 0, y = 0): Rectangle {
    return new Rectangle(this.left + x, this.top + y, this.width, this.height );
  }

  public Scale(scale_x = 1, scale_y = scale_x): Rectangle {
    return new Rectangle(this.left * scale_x, this.top * scale_y, this.width * scale_x, this.height * scale_y);
  }

  /** returns a new rect expanded from this one by (x,y) */
  public Expand(x = 0, y = 0): Rectangle {
    return new Rectangle(this.left, this.top, this.width + x, this.height + y );
  }

  /** returns a new rectangle that combines this rectangle with the argument */
  public Combine(rect: Rectangle): Rectangle {
    return new Rectangle(
      Math.min(this.left, rect.left),
      Math.min(this.top, rect.top),
      Math.max(this.right, rect.right) - Math.min(this.left, rect.left),
      Math.max(this.bottom, rect.bottom) - Math.min(this.top, rect.top),
    );
  }

  /*
   * removing this method as part of cleaning up bitwise flags.
   * if you need this method, rewrite it to use explicit flags.
   *
  public CheckEdges(x: number, y: number, border = 16): number{

    let edge = 0;

    // tslint:disable-next-line:no-bitwise
    if (x - this.left < border) edge |= 1;

    // tslint:disable-next-line:no-bitwise
    if (this.right - x < border) edge |= 2;

    // tslint:disable-next-line:no-bitwise
    if (y - this.top < border) edge |= 4;

    // tslint:disable-next-line:no-bitwise
    if (this.bottom - y < border) edge |= 8;

    return edge;
  }
  */

  /**
   * check if rectangle contains the given coordinates, optionally with
   * some added padding
   */
  public Contains(x: number, y: number, padding = 0): boolean {
    return (x >= this.left - padding)
      && (x <= (this.left + this.width + padding))
      && (y >= this.top - padding)
      && (y <= (this.top + this.height + padding));
  }

  /** convenience method for canvas */
  public ContextFill(context: CanvasRenderingContext2D){
    context.fillRect(this.left, this.top, this.width, this.height);
  }

  /** convenience method for canvas */
  public ContextStroke(context: CanvasRenderingContext2D){
    context.strokeRect(this.left, this.top, this.width, this.height);
  }

  /** clamp coordinate to rectangle */
  public Clamp(x: number, y: number){
    x = Math.min(Math.max(x, this.left), this.right);
    y = Math.min(Math.max(y, this.top), this.bottom);
    return { x, y };
  }

  /** convenience method for html element style */
  public ApplyStyle(element: HTMLElement){
    element.style.top = this.top + 'px';
    element.style.left = this.left + 'px';
    element.style.width = this.width + 'px';
    element.style.height = this.height + 'px';
  }

  public toJSON(){
    return {
      top: this.top, left: this.left, width: this.width, height: this.height,
    };
  }

}
