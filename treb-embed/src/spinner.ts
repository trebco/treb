
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
