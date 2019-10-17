
/**
 * this interface is used to support construction from rectangles
 * or things that resemble rectangles
 */
export interface IRectangle {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}

export class Rectangle implements IRectangle {

  public get right(){ return this.left + this.width; }
  public get bottom(){ return this.top + this.height; }

  /**
   * create a rectangle from an object that looks like a rectangle,
   * probably a serialized object
   */
  public static Create(obj: IRectangle){
    return new Rectangle(
      obj.left || 0,
      obj.top || 0,
      obj.width || 0,
      obj.height || 0);
  }

  constructor(  public left = 0,
                public top = 0,
                public width = 0,
                public height = 0 ){}

  /** returns a new rect shifted from this one by (x,y) */
  public Shift(x = 0, y = 0) {
    return new Rectangle(this.left + x, this.top + y, this.width, this.height );
  }

  /** returns a new rect expanded from this one by (x,y) */
  public Expand(x = 0, y = 0){
    return new Rectangle(this.left, this.top, this.width + x, this.height + y );
  }

  /** returns a new rectangle that combines this rectangle with the argument */
  public Combine(rect: Rectangle){
    return new Rectangle(
      Math.min(this.left, rect.left),
      Math.min(this.top, rect.top),
      Math.max(this.right, rect.right) - Math.min(this.left, rect.left),
      Math.max(this.bottom, rect.bottom) - Math.min(this.top, rect.top),
    );
  }

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
