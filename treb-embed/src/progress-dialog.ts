
/**
 * colors, which can be controlled by the grid theme
 */
export interface MaskDialogOptions {
  background?: string;
  border?: string;
  text?: string;
  mask?: string;
  progress?: string;
}

/**
 * modal informational dialog that covers the embedded
 * spreadsheet. not fancy.
 */
export class ProgressDialog {

  private mask: HTMLElement;
  private dialog: HTMLElement;

  private content_node: HTMLElement;
  private progress_container: HTMLElement;
  private progress_bar: HTMLElement;

  // tslint:disable-next-line:variable-name
  private visible_ = false;

  private set message(value: string) {
    this.content_node.textContent = value;
  }

  private set progress(value: number) {
    this.progress_bar.style.width = `${value}%`;
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

    this.dialog = document.createElement('div');
    this.dialog.setAttribute('class', 'treb-embed-dialog');
    this.mask.appendChild(this.dialog);

    this.content_node = document.createElement('div');
    this.content_node.setAttribute('class', 'treb-embed-dialog-message');
    this.dialog.appendChild(this.content_node);

    this.progress_container = document.createElement('div');
    this.progress_container.setAttribute('class', 'treb-embed-progress-container');
    this.dialog.appendChild(this.progress_container);

    this.progress_bar = document.createElement('div');
    this.progress_bar.setAttribute('class', 'treb-embed-progress-bar');
    this.progress_container.appendChild(this.progress_bar);

    /*
    this.dialog = document.createElement('pre');
    this.dialog.setAttribute('class', 'treb-embed-dialog');
    this.mask.appendChild(this.dialog);
    */

    // this.dialog.textContent = ' ';
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
    if (options.progress) {
      this.progress_bar.style.backgroundColor = options.progress;
    }

  }

  public Update(message?: string, progress?: number){
    if (typeof message !== 'undefined'){
      this.message = message;
    }
    if (typeof progress !== 'undefined') {
      this.progress = progress;
    }
  }

  public HideDialog() {
    this.visible = false;
  }

  public ShowMessageDialog(message?: string) {
    if (typeof message !== 'undefined'){
      this.message = message;
    }
    this.progress_container.style.display = 'none';
    this.visible = true;
  }

  public ShowProgressDialog(message?: string, progress?: number) {
    if (typeof message !== 'undefined'){
      this.message = message;
    }
    if (typeof progress !== 'undefined') {
      this.progress = progress;
    }
    this.progress_container.style.display = 'block';
    this.visible = true;
  }

  public XShow(show = true, message?: string, progress?: number){
    if (typeof message !== 'undefined'){
      this.message = message;
    }
    if (typeof progress !== 'undefined') {
      this.progress = progress;
      //if (show) {
      //  this.progress_container.style.display = 'block';
      //}
    }
    else {
      // this.progress_container.style.display = 'none';
    }
    this.visible = show;
  }

}
