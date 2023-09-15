
import { Editor, type NodeDescriptor } from './editor';

export class ExternalEditor extends Editor {

  public get active() {
    return this.nodes.length > 0;
  }

  public Reset() {
    this.AttachNodes();
  }

  /**
   * attach to a set of nodes (one is fine). 
   * 
   * FIXME: since this is not used in subclasses for ICE and formula bar,
   * perhaps we should move it into a new subclass specifically for 
   * external editor. we can add some flags as well. TODO/FIXME
   * 
   * update modifying how this works. we will now watch focus ourselves.
   */
  public AttachNodes(nodes: HTMLElement[] = [], assume_formula = true) {

    this.assume_formula = assume_formula;

    // try to preserve any nodes/descriptors we've already "cooked",
    // since this may get called multiple times when you switch between 
    // fields.

    // (that's less true than before, but still might happen).

    let descriptors: NodeDescriptor[] = [];

    descriptors = nodes.map(node => {
      for (const compare of this.nodes) {
        if (compare.node === node) {
          return compare;
        }
      }
      return { node }; // not found, return a new one
    });

    // we should probably clean up here. if there's overlap we will just 
    // add a new one. note that we're looping over the *old* set here, 
    // so don't try to optimize by moving this into another loop.

    for (const descriptor of this.nodes) {
      if (descriptor.listeners) {
        for (const [key, value] of descriptor.listeners.entries()) {
          descriptor.node.removeEventListener(key, value);
        }
        descriptor.listeners.clear();
      }
    }

    this.nodes = descriptors;
    
    
    for (const descriptor of this.nodes) {

      // check if we need to flush the cached text 

      if (descriptor.formatted_text === descriptor.node.textContent) {
        const test = descriptor.node.innerHTML.length;
        if (descriptor.check !== test) {
          descriptor.formatted_text = undefined; // flush
        }
      }

      // if it's already focused, set as active

      if (document.activeElement === descriptor.node) {
        this.active_editor = descriptor;
      }

      // format

      this.UpdateText(descriptor, { toll_events: true });

      // add listeners

      this.RegisterListener(descriptor, 'focusin', () => {
        // console.info('focusin');
        this.active_editor = descriptor;
      });

      this.RegisterListener(descriptor, 'focusout', () => {
        // console.info('focusout');
        this.active_editor = undefined;
      });

      this.RegisterListener(descriptor, 'input', (event: Event) => {

        // we're filtering on trusted here because we send an event.
        // but when we send that event we also trigger an update.
        // so... why not just run through the event handler? 

        if (event.isTrusted) {
          this.UpdateText(descriptor);
          this.UpdateColors(); // will send a local event
        }

      });


    }

    this.UpdateColors(true); // always send an event, just in case

  }

}