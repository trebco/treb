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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import {tmpl, NodeModel} from 'treb-utils'; 
import '../style/icon.scss';

/* *
 * colors, which can be controlled by the grid theme
 * /
export interface MaskDialogOptions {
  background?: string;
  border?: string;
  text?: string;
  mask?: string;
  progress?: string;
  fontSize?: string|number;
  fontFamily?: string;
}
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
  // html?: string;
  icon?: string|boolean;
  close_box?: boolean;
  timeout?: number;
  type?: DialogType;
  // progress?: number;
  // progress_bar?: boolean;
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

  // public static unique_id = Math.random().toString(36).substring(2, 15);

  private model: NodeModel;

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

  /*
  private set progress(value: number) {
    this.progress_bar.style.width = `${value}%`;
  }
  */

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
      // (this.parent_node.firstChild as HTMLElement)?.classList.add('masked');
      this.parent_node.classList.add('masked');

      this.model.mask.classList.add('visible'); 
      window.addEventListener('keydown', this.event_handler);
    }
    else { 
      // (this.parent_node.firstChild as HTMLElement)?.classList.remove('masked');
      this.parent_node.classList.remove('masked');

      this.model.mask.classList.remove('visible'); 
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

  constructor(private parent_node: HTMLElement) { // }, options: MaskDialogOptions = {}) {

    this.model = tmpl`
      <div id='mask' class='treb-embed-mask'>
        <div id='dialog' class='treb-embed-dialog'>
          <div id='left'>
            <a href='https://treb.app' target='_blank'>
              <div class='treb-icon-64'></div>
            </a>
          </div>
          <div id='middle'>
            <div id='title' class='treb-embed-dialog-title'></div>
            <div id='message' class='treb-embed-dialog-message'></div>
            <div id='about' class='treb-embed-dialog-body'>
              TREB version ${process.env.BUILD_VERSION}
              ${process.env.NODE_ENV === 'production' ? '' : `<div class='smaller'>(development build)</div>`}
              <div class='smaller'><a target=_blank href='https://treb.app'>http://treb.app</a></div>
            </div>
          </div>
          <button type='button' title='Close dialog' id='close' class='close-box'>
            <svg viewBox='0 0 16 16'>
              <path d='M11.854 4.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708-.708l7-7a.5.5 0 0 1 .708 0z'/>
              <path d='M4.146 4.146a.5.5 0 0 0 0 .708l7 7a.5.5 0 0 0 .708-.708l-7-7a.5.5 0 0 0-.708 0z'/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.model.close.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.HideDialog();
    });
  
    parent_node.appendChild(this.model.mask);

  }

  private Div(class_name?: string, parent?: HTMLElement): HTMLDivElement {
    const div = document.createElement('div');
    if (class_name) { div.setAttribute('class', class_name); }
    if (parent) { parent.appendChild(div); }
    return div;
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
