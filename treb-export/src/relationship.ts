
export interface Relationship {
  id: string,
  type: string,
  target: string,
  mode?: string;
}

export type RelationshipMap = Record<string, Relationship>;

export const AddRel = (map: RelationshipMap, type: string, target: string, mode?: string): string => {
  const index = Object.keys(map).length + 1;
  const rel = `rId${index}`;
  map[rel] = { id: rel, type, target, mode };
  return rel;
};
