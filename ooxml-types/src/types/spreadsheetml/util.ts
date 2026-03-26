export type OneOrMany<T> = T | T[];

/** xsd:boolean allows "true"/"false" and "1"/"0"; the parser produces boolean or number respectively. */
export type XsdBoolean = boolean | number;

export interface TextElement {
  $text?: string;
}

/** Element whose only content is a `val` attribute, e.g. `<sz val="11"/>`. */
export interface ValElement<T = string> {
  $attributes?: {
    val: T;
  };
}
