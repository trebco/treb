import type { OneOrMany } from "./util.js";

export interface Drawing {
  $attributes?: {
    id: string;
  };
}

export interface TablePart {
  $attributes?: {
    id: string;
  };
}

export interface TableParts {
  $attributes?: {
    count?: number;
  };
  tablePart?: OneOrMany<TablePart>;
}

export interface Extension {
  $attributes?: {
    uri: string;
  };
  [key: string]: unknown;
}

export interface ExtensionList<E extends Extension = Extension> {
  ext?: OneOrMany<E>;
}

export type OleObjects = Record<string, unknown>;

export type Controls = Record<string, unknown>;
