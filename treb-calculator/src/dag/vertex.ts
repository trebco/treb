
export enum Color {
  white, gray, black
}

export class Vertex {

  // --- members ---

  public type = 'vertex'; // for type guard

  public color = Color.white; // for loop check

  /** dependencies */
  public edges_in: Vertex[] = [];

  /** dependents */
  public edges_out: Vertex[] = [];

  // --- accessors ---

  get has_inbound_edges() { return this.edges_in.length > 0; }

  get has_outbound_edges() { return this.edges_out.length > 0; }

  // --- cleanup operations ---

  /** reset this node */
  public Reset() {

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
  public ClearDependencies() {
    for (const edge of this.edges_in) {
      edge.RemoveDependent(this);
    }
    this.edges_in = [];
  }

  // --- basic node operations ---

  /** add a dependent. doesn't add if already in the list */
  public AddDependent(edge: Vertex) {
    if (edge === this) return; // circular
    for (const check of this.edges_out) {
      if (check === edge) {
        return;
      }
    }
    this.edges_out.push(edge);
  }

  /** remove a dependent */
  public RemoveDependent(edge: Vertex) {
    this.edges_out = this.edges_out.filter((check) => check !== edge);
  }

  /** add a dependency. doesn't add if already in the list */
  public AddDependency(edge: Vertex) {
    if (edge === this) return; // circular
    for (const check of this.edges_in) {
      if (check === edge) {
        return;
      }
    }

    this.edges_in.push(edge);
  }

  /** remove a dependency */
  public RemoveDependency(edge: Vertex) {
    this.edges_in = this.edges_in.filter((check) => check !== edge);
  }

  /**
   * 
   */
  public LoopCheck(): boolean {
    this.color = Color.gray;

    for (const edge of this.edges_out) {
      if (edge.color === Color.gray) { return true; } // loop
      if (edge.color === Color.white) {
        if (edge.LoopCheck()) { return true; } // loop
      }
    }

    this.color = Color.black;
    return false;
  }

}


