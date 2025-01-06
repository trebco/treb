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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import { DOMContext } from 'treb-base-types';
import { NumberFormat, NumberFormatCache, ValueParser } from 'treb-format';
import { ValueType } from 'treb-base-types';
import { EventSource } from 'treb-utils';

export interface ScaleEvent {
  type: 'scale';
  value: number;
  keep_focus?: boolean;
}

/**
 * updated scale control, broken out. this is based on what we did for
 * project planning, which worked out rather nicely.
 */

export class ScaleControl extends EventSource<ScaleEvent> {

  private input: HTMLInputElement;
  private slider: HTMLInputElement;
  private scale = 0;
  private format: NumberFormat;

  private timeout = 0;

  public constructor(public container: HTMLElement) {
    super();

    this.format = NumberFormatCache.Get('0.0');

    const DOM = DOMContext.GetInstance(container.ownerDocument);

    this.input = DOM.Create('input', 'treb-scale-input', container, {
      events: {

        // is this for some x-browser issue? or did we just not 
        // know which event to use and this is old junk?

        keypress: (event) => {
          switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
              event.stopPropagation();
              event.preventDefault();
              console.info('mark?');
              break;
          }
        },

        keydown: (event) => {

          switch (event.key) {
            case 'Enter':
              this.input.blur();
              break;

            case 'ArrowUp':
              this.Tick(-1);
              break;

            case 'ArrowDown':
              this.Tick(1);
              break;

            case 'Escape':
              this.input.value = this.format.Format(this.scale) + '%';
              this.input.blur();
              break;

            default:
              return;

          }

          event.stopPropagation();
          event.preventDefault();

        },

        // select text on click
        focusin: () => this.input.select(),

        change: () => {

          // what we're doing here is a little unusual. we always treat
          // the value as a percent, even if there's no percent sign.

          // for that to work, if there is a percent sign, we need to remove
          // it before we continue. then try to parse as a number.

          let text = this.input.value;
          text = text.replace(/%/g, '');

          const value = ValueParser.TryParse(text);
          if (value.type === ValueType.number) {
            this.UpdateScale(Number(value.value), true);
          }
          else {
            this.input.value = this.format.Format(this.scale) + '%';
          }

        },

      }
    });

    const popup = DOM.Div('treb-slider-container', container);

    this.slider = DOM.Create('input', undefined, popup, {
      attrs: {
        type: 'range',
        min: '50',
        max: '200',
        value: '100',
        step: '2.5',
      },
      events: {
        input: () => this.UpdateScale(Number(this.slider.value), true),
      }
    });

    container.addEventListener('wheel', (event: WheelEvent) => {
      event.stopPropagation();
      event.preventDefault();
      this.Tick(event.deltaY)
    });

  }

  public Tick(value: number): void {

    // normalize

    const scale = Math.round(this.scale / 2.5) * 2.5;

    if (value > 0) {
      this.UpdateScale(scale - 2.5, true, true);
    }
    else if (value < 0){
      this.UpdateScale(scale + 2.5, true, true);
    }

  }

  public UpdateScale(scale: number, notify = false, keep_focus = false): void {

    scale = Math.max(50, Math.min(200, scale));
    if (scale !== this.scale) { 
      this.scale = scale;
      this.input.value = this.format.Format(scale) + '%';
      this.slider.value = scale.toFixed(1);
      
      if (notify) {
        if (!this.timeout) {
          this.timeout = requestAnimationFrame(() => {
            this.timeout = 0;
            this.Publish({
              type: 'scale', 
              value: this.scale / 100,
              keep_focus,
            });
          });
        }
      }
    }
  }

}

