
/**
 * support for resizable node, drag handle, drag rect, mask
 * FIXME: make this composable (decorator?)
 * FIXME: make this generic, we can use it for some other stuff (charts?)
 */
export class Resizable {

  private static resize_mask: HTMLElement;
  private static resize_rect: HTMLElement;

  constructor(container: HTMLElement, node: HTMLElement, resize_callback: () => void) {

    const resize_handle = document.createElement('div');
    resize_handle.classList.add('treb-embed-resize-handle');
    container.appendChild(resize_handle);

    if (!Resizable.resize_mask) {
      let mask = document.querySelector('.treb-embed-mouse-mask');
      if (!mask) {
        mask = document.createElement('div');
        mask.classList.add('treb-embed-mouse-mask');
        document.body.appendChild(mask);
      }
      Resizable.resize_mask = mask as HTMLElement;
    }

    if (!Resizable.resize_rect) {
      let rect = document.querySelector('.treb-embed-resize-rect');
      if (!rect) {
        rect = document.createElement('div');
        rect.classList.add('treb-embed-resize-rect');
        Resizable.resize_mask.appendChild(rect);
      }
      Resizable.resize_rect = rect as HTMLElement;
    }

    let mouseup: (event: MouseEvent) => void;
    let mousemove: (event: MouseEvent) => void;

    let container_rect = { width: 0, height: 0 };
    let offset = { x: 0, y: 0 };
    let delta = { x: 0, y: 0 };

    const cleanup = () => {

      Resizable.resize_mask.removeEventListener('mousemove', mousemove);
      Resizable.resize_mask.removeEventListener('mouseup', mouseup);
      Resizable.resize_mask.style.display = 'none';

      if (delta.x || delta.y) {
        const bounding_rect = container.getBoundingClientRect();
        const width = bounding_rect.width + delta.x;
        const height = bounding_rect.height + delta.y;
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        resize_callback();
      }

    };

    mousemove = (event: MouseEvent) => {

      if (!event.buttons) {
        cleanup();
        return;
      }

      if (delta.x !== event.clientX - offset.x) {
        delta.x = event.clientX - offset.x;
        Resizable.resize_rect.style.width = `${container_rect.width + delta.x + 4}px`;
      }
      if (delta.y !== event.clientY - offset.y) {
        delta.y = event.clientY - offset.y;
        Resizable.resize_rect.style.height = `${container_rect.height + delta.y + 4}px`;
      }
    };

    mouseup = (event: MouseEvent) => {
      cleanup();
    };

    resize_handle.addEventListener('mousedown', (event) => {

      event.stopPropagation();
      event.preventDefault();

      const bounding_rect = node.getBoundingClientRect();
      container_rect = { width: bounding_rect.width, height: bounding_rect.height };

      if (Resizable.resize_rect) {
        Resizable.resize_rect.style.top = `${bounding_rect.top - 2}px`;
        Resizable.resize_rect.style.left = `${bounding_rect.left - 2}px`;
        Resizable.resize_rect.style.width = `${bounding_rect.width + 4}px`;
        Resizable.resize_rect.style.height = `${bounding_rect.height + 4}px`;
      }

      offset = { x: event.clientX, y: event.clientY };
      delta = { x: 0, y: 0 };

      Resizable.resize_mask.style.display = 'block';
      Resizable.resize_mask.addEventListener('mousemove', mousemove);
      Resizable.resize_mask.addEventListener('mouseup', mouseup);

    });

  }

}
