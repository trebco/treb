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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

export class Spinner {

  private node: HTMLDivElement;
  private visible = false;

  constructor(public container: HTMLElement) {
    this.node = document.createElement('div');
    this.node.classList.add('treb-spinner');
    this.node.innerHTML = `<div><div></div><div></div><div></div><div></div></div>`;
    container.appendChild(this.node);
  }

  public Show(): void {
    this.node.classList.add('visible');
  }

  public Hide() {
    this.node.classList.remove('visible');
  }

}
