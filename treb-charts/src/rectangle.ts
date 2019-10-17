
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export class Area {

  public get width() { return this.right - this.left; }
  public get height() { return this.bottom - this.top; }

  public get center(): Point {
    return {
      x: this.left + this.width / 2,
      y: this.top + this.height / 2,
    };
  }

  constructor(
    public left = 0,
    public top = 0,
    public right = 100,
    public bottom = 100) {

  }

}
