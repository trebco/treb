
/**
 * colors, which can be controlled by the grid theme
 */
export interface MaskDialogOptions {
  background?: string;
  border?: string;
  text?: string;
  mask?: string;
}

/**
 * modal informational dialog that covers the embedded
 * spreadsheet. not fancy.
 */
export class MaskDialog {

  private mask: HTMLElement;
  private dialog: HTMLElement;

  // tslint:disable-next-line:variable-name
  private visible_ = false;

  private set message(value: string) {
    this.dialog.textContent = value;
  }

  private set visible(value: boolean){
    this.visible_ = value;
    let class_name = this.mask.className;
    class_name = class_name.replace(/\bvisible\b/g, '').trim();
    if (this.visible_){
      class_name = class_name + ' visible';
    }
    this.mask.className = class_name;
  }

  private get visible(){
    return this.visible_;
  }

  constructor(private parent_node: HTMLElement, options: MaskDialogOptions = {}) {

    this.mask = document.createElement('div');
    this.mask.setAttribute('class', 'treb-embed-mask');
    parent_node.appendChild(this.mask);

    this.dialog = document.createElement('pre');
    this.dialog.setAttribute('class', 'treb-embed-dialog');
    this.mask.appendChild(this.dialog);

    this.dialog.textContent = ' ';
    this.UpdateTheme(options);

  }

  public UpdateTheme(options: MaskDialogOptions) {

    if (options.mask) {
      this.mask.style.backgroundColor = options.mask;
    }
    if (options.background) {
      this.dialog.style.backgroundColor = options.background;
    }
    if (options.text) {
      this.dialog.style.color = options.text;
    }
    if (options.border) {
      this.dialog.style.borderColor = options.border;
    }

  }

  public Update(message = ''){
    if (!this.visible) {
      this.Show(true, message);
    }
    else {
      this.message = message;
    }
  }

  public Show(show = true, message?: string){
    if (typeof message !== 'undefined'){
      this.message = message;
    }
    this.visible = show;
  }

}
