
import { CellStyle, IArea } from 'treb-base-types';

/** 
 * conditional format predicated on an expression. if the expression 
 * evaluates to true, we apply the style. otherwise no.
 */
export interface ConditionalFormatExpression {
  type: 'expression';
  area: IArea;
  style: CellStyle;
  expression: string;
}

/** 
 * union, plus we're adding a state used to track application.
 * that state should not be serialized (or should it? ...)
 */
export type ConditionalFormat = ConditionalFormatExpression & { applied?: boolean };

/**
 * the list of formats, in reverse order of precedence. as a starting
 * point we're using the naive approach, just applying everything in
 * order. that may change.
 */
export type ConditionalFormatList = ConditionalFormat[];

