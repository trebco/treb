/**
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
 * Copyright 2022 trebco, llc. + info@treb.app
 */

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
