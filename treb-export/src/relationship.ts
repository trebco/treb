
export interface Relationship {
  id: number,
  type: string,
  target: string,
}

export type RelationshipMap = Record<string, Relationship>;
