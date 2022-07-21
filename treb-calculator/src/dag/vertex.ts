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

/**
 * colors for the CLRS color algorithm. 
 * 
 * these colors are useful because gray is "in between" white and black, but
 * (outside of the general move away from using white/black as identifiers) it 
 * might be easier to conceptualize with descriptive labels like "untested" 
 * (white), "being tested", (gray) and "testing complete" (black).
 */
export enum Color {
  white, gray, black
}

export class Vertex {

  /** 
   * vertex and its subclasses have a type parameter for type 
   * guards/reflection; each instance has a type that is set
   * to the static class type.
   */
  public static type = 'vertex';

  // --- members ---

  public type = Vertex.type; // for type guard

  public color = Color.white; // for loop check

  /** dependencies */
  public edges_in: Vertex[] = [];

  /** dependents */
  public edges_out: Vertex[] = [];

  // --- accessors ---

  get has_inbound_edges(): boolean { return this.edges_in.length > 0; }

  get has_outbound_edges(): boolean { return this.edges_out.length > 0; }

  // --- cleanup operations ---

  /** reset this node */
  public Reset(): void {

    for (const edge of this.edges_out) {
      edge.RemoveDependency(this);
    }

    for (const edge of this.edges_in) {
      edge.RemoveDependent(this);
    }

    this.edges_out = [];
    this.edges_in = [];

  }

  /** removes all inbound edges (dependencies) */
  public ClearDependencies(): void {
    for (const edge of this.edges_in) {
      edge.RemoveDependent(this);

      // testing inline...
      // edge.edges_out = edge.edges_out.filter(check => check !== this);      

    }
    this.edges_in = [];
  }

  // --- basic node operations ---

  /** add a dependent. doesn't add if already in the list */
  public AddDependent(edge: Vertex): void {
    if (edge === this) return; // circular
    for (const check of this.edges_out) {
      if (check === edge) {
        return;
      }
    }
    this.edges_out.push(edge);
  }

  /** remove a dependent */
  public RemoveDependent(edge: Vertex): void {

    // this.edges_out = this.edges_out.filter((check) => check !== edge);

    // updated for performance.

    // this seems to be faster than any other method of removing an item.
    // (also tried: temp loop and copy non-matching).

    // this does assume that edges can't be in the list twice, but that
    // should already be true (it would cause all sorts of other problems).

    // actually does this just win because we break the loop earlier?
    // (presumably in 50% of cases)? even if so, if the splice is not 
    // more expensive this is a win.

    // splice should be expensive, though... weird. because what splice
    // does (AIUI) is reassign array indexes above the delete index.
    // it would be better if we could get rid of indexes altogether, perhaps
    // using a set?

    // note: tried to improve on splice with some direct methods, nothing
    // seemed to work any better (not worse, either, but if there's no 
    // improvement we should use the native method).

    for (let i = 0; i < this.edges_out.length; i++) {
      if (this.edges_out[i] === edge) {
        this.edges_out.splice(i, 1);
        return;
      }
    }

  }

  /** add a dependency. doesn't add if already in the list */
  public AddDependency(edge: Vertex): void {
    if (edge === this) return; // circular
    for (const check of this.edges_in) {
      if (check === edge) {
        return;
      }
    }

    this.edges_in.push(edge);
  }

  /** remove a dependency */
  public RemoveDependency(edge: Vertex): void {
    this.edges_in = this.edges_in.filter((check) => check !== edge);
  }

  /** 
   * this is a composite operation, because the operations are always called 
   * in pairs. this means create a pair of links such that _edge_ depends on
   * _this_.
   */
  public LinkTo(edge: Vertex): void {
    this.AddDependent(edge);
    edge.AddDependency(this);
  }

  /**
   * this is an alteranate formulation that may make more intuitive sense.
   * it creates a pair of forward/backward links, such that _this_ depends
   * on _edge_.
   */
  public DependsOn(edge: Vertex): void {
    this.AddDependency(edge);
    edge.AddDependent(this);
  }

  /**
   * this is called during calculation (if necessary). on a hit (loop), we 
   * reset the color of this, the test node, to white. there are two reasons 
   * for this: 
   * 
   * one, we want subsequent tests to also find the hit. in some cases we may
   * not be marking the node as a loop (if it precedes the backref in the graph),
   * so we want subsequent nodes to also hit the loop. [Q: this makes no sense,
   * because this would still hit if the node were marked grey, assuming you
   * test for that].
   * 
   * two, if you fix the loop, on a subsequent call we want to force a re-check,
   * which we can do if the vertex is marked white. [Q: could also be done on
   * gray?]
   * 
   * [A: logically you are correct, but this works, and matching grey does not].
   */
  public LoopCheck(): boolean {


    const stack: Vertex[] = [this];

    while (stack.length) {

      // note peek: we leave it on the stack
      const v = stack[stack.length - 1];

      // state flag: unset if we have edges we need to check
      let complete = true;

      // skip this vertex if it's clean
      if (v.color !== Color.black) {

        v.color = Color.gray; // set here, not top of function

        for (const edge of v.edges_out) {

          if (edge.color === Color.gray) {
            this.color = Color.white; // note: this, not v
            return true; // found a loop
          }

          if (edge.color === Color.white && edge.edges_out.length) {
            stack.push(edge);
            complete = false;

            // the only thing this break does is add loops. we can 
            // safely add all (white) edges as long as we don't color 
            // them here -- that was the issue in the last version.

            // break; // ?

            // if you really want fidelity with the recursive version
            // you could reverse the order, but the order is arbitrary
            // anyway so it makes no difference.

          }

        }

      }

      if (complete) {
        v.color = Color.black;
        stack.pop();
      }

    }


    /*
    this.color = Color.gray;
   
    // switch to stack algorithm. see the method in Graph for details.

    // NOTE: this is bugged. need to rewrite. it's generating false positives
    // where the recursive version still works.

    const stack: Vertex[] = [this];

    while (stack.length) {

      const v = stack[stack.length - 1];
      let completed = true;

      if (v.color !== Color.black) {

        for (const edge of v.edges_out) {

          if (edge.color === Color.gray) {

            // this is different than the graph algo, here we reset the 
            // color when we hit a loop.

            this.color = Color.white; // someone else can test
            return true; // loop
   
          }
          else if (edge.color === Color.white) {
            edge.color = Color.gray;
            stack.push(edge);
            completed = false;
          }

        }

      }

      if (completed) {
        stack.pop();
        v.color = Color.black;
      }

    }
    */
    
    /*
    // the old recursive version

    for (const edge of this.edges_out) {
      if (edge.color === Color.gray || (edge.color === Color.white && edge.LoopCheck())) { 
        this.color = Color.white; // someone else can test
        return true; // loop
      } 
    }
    */

    this.color = Color.black;
    return false;
  }

  /*
  public LoopCheck2(compare: Vertex = this): boolean {
    this.color = Color.gray;

    for (const edge of this.edges_out) {
      if (edge.color === Color.gray || (edge.color === Color.white && edge.LoopCheck2(compare))) { 
        this.color = Color.white; // someone else can test
        return edge === compare; // loop
      } 
    }

    this.color = Color.black;
    return false;
    
  }
  */

}


