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

export enum DialogType {
  default = '', 
  info = 'info',
  error = 'error',
  warning = 'warning',
  success = 'success',
  about = 'about',
  initial = 'initial',
}

export interface MessageDialogOptions {
  title?: string;
  message?: string;
  icon?: string|boolean;
  close_box?: boolean;
  timeout?: number;
  type?: DialogType;
}

export type ResolutionFunction = () => void;

/**
 * rebuilding the dialog, like this:
 * 
 * +======================================================+
 * |        |   TITLE                             |    [X]|
 * | [icon] |   message                           |       |
 * |        |   (progress bar?)                   |       |
 * +------------------------------------------------------+
 * 
 */

/**
 * modal informational dialog that covers the embedded
 * spreadsheet. not fancy.
 */
export class Dialog {

  // private model: NodeModel;
  private model: Record<string, HTMLElement> = {};

  private layout_element: HTMLElement;

  // tslint:disable-next-line:variable-name
  private visible_ = false;

  private timeout = 0;

  private pending_dialog_resoltion: ResolutionFunction[] = [];

  private options_: Partial<MessageDialogOptions> = {
    type: DialogType.initial,
  };

  private set options(options: Partial<MessageDialogOptions>) {

    if (options.type === DialogType.about) {
      options.close_box = true;
      options.icon = true;
    }

    if (this.options_.icon !== options.icon) {
      this.model.left.style.display = options.icon ? 'block' : 'none';
    }

    if (this.options_.close_box !== options.close_box) {
      this.model.close.style.display = options.close_box ? 'block' : 'none';
    }

    if (this.options_.message !== options.message) {
      this.model.message.textContent = options.message || '';
      this.model.message.style.display = options.message ? 'block' : 'none';
    }

    if (this.options_.title !== options.title) {
      this.model.title.textContent = options.title || '';
      this.model.title.style.display = options.title ? 'block' : 'none';
    }

    if (this.options_.type !== options.type) {
      let classes = this.model.dialog.className.replace(/dialog-type-\S+/g, '').trim();
      if (options.type) { classes += ` dialog-type-${options.type}`; }
      this.model.dialog.className = classes;

      if (options.type === 'about') {
        this.model.about.style.display = 'block';
      }
      else {
        this.model.about.style.display = 'none';
      }

    }

    this.options_ = options;


  }

  private event_handler = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.stopPropagation();
      event.preventDefault();
      this.visible = false;
    }
  }

  private get visible(){
    return this.visible_;
  }

  private set visible(value: boolean){

    if (value === this.visible_) { return; }
    this.visible_ = value;

    // we want to mask not just the spreadsheet but also the toolbar and 
    // sidebar. unfortunately we built the node structure the other way.
    // not a real problem though, just requires some reacharound

    // actually check that we can do that with CSS -- siblings FTW

    if (value) { 
      this.layout_element?.setAttribute('dialog', '');
      window.addEventListener('keydown', this.event_handler);
    }
    else { 
      this.layout_element?.removeAttribute('dialog');
      window.removeEventListener('keydown', this.event_handler);
      const tmp = this.pending_dialog_resoltion.slice(0);
      this.pending_dialog_resoltion = [];
      Promise.resolve().then(() => {
        for (const func of tmp) {
          func();
        }
      });
    }

  }

  constructor(parent_node: HTMLElement) { // }, options: MaskDialogOptions = {}) {

    this.layout_element = parent_node.parentElement as HTMLElement;

    const root = this.layout_element?.querySelector('.treb-dialog-mask') as HTMLElement;
    if (root) {
      const elements = root.querySelectorAll('[data-bind]') as NodeListOf<HTMLElement>;
      for (const element of Array.from(elements)) {
        const bind = element.dataset.bind;
        if (bind) {
          this.model[bind] = element;
        }
      }
      // console.info({model: this.model});
    }

    if (this.model.about) {
      const html: string[] = [`<div>TREB version ${process.env.BUILD_VERSION}`];
      if (process.env.NODE_ENV !== 'production') {
        html.push(`<small>(development build)</small>`);
      }
      html.push( `<small><a target=_blank href='https://treb.app'>http://treb.app</a></small>` )
      this.model.about.innerHTML = html.join('\n');
    }

    this.model.close?.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.HideDialog();
    });
 

  }

  public Update(options: Partial<MessageDialogOptions>, delta = true): void {
    if (delta) {
      options = { ...this.options_, ... options};
    }
    this.options = options;
  }

  public HideDialog(): void {
    this.visible = false;
  }

  public ShowDialog(options: Partial<MessageDialogOptions>): Promise<void> {
    return new Promise((resolve) => {

      this.pending_dialog_resoltion.push(resolve);
      this.options = options;
      this.visible = true;
      
      if (this.timeout) { 
        window.clearTimeout(this.timeout); 
        this.timeout = 0;
      }
      
      if (options.timeout) {
        this.timeout = window.setTimeout(() => this.HideDialog(), options.timeout);
      }

    });
  }

}
