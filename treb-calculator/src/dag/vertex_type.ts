
export class VertexType {

  // --- members ---

  public type = 'vertex'; // for type guard

  /** dependencies */
  public edges_in: VertexType[] = [];

  /** dependents */
  public edges_out: VertexType[] = [];

  // --- accessors ---

  get has_inbound_edges() { return this.edges_in.length > 0; }

  get has_outbound_edges() { return this.edges_out.length > 0; }

  // --- cleanup operations ---

  /** reset this node */
  public Reset() {
    this.edges_out.forEach((edge) => edge.RemoveDependency(this));
    this.edges_out = [];
    this.edges_in.forEach((edge) => edge.RemoveDependent(this));
    this.edges_in = [];
  }

  /** removes all inbound edges (dependencies) */
  public ClearDependencies() {
    this.edges_in.forEach((edge) => edge.RemoveDependent(this));
    this.edges_in = [];
  }

  // --- basic node operations ---

  /** add a dependent. doesn't add if already in the list */
  public AddDependent(edge: VertexType) {
    if (edge === this) return; // circular
    if (this.edges_out.some((check) => check === edge)) return; // already in there
    this.edges_out.push(edge);
  }

  /** remove a dependent */
  public RemoveDependent(edge: VertexType) {
    this.edges_out = this.edges_out.filter((check) => check !== edge);
  }

  /** add a dependency. doesn't add if already in the list */
  public AddDependency(edge: VertexType) {
    if (edge === this) return; // circular
    if (this.edges_in.some((check) => check === edge)) return; // already in there
    this.edges_in.push(edge);
  }

  /** remove a dependency */
  public RemoveDependency(edge: VertexType) {
    this.edges_in = this.edges_in.filter((check) => check !== edge);
  }

}


