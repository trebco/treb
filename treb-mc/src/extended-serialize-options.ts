
import type { SerializeOptions } from 'treb-grid';

export interface ExtendedSerializeOptions extends SerializeOptions {

  preserve_simulation_data?: boolean;

  /** save simulation data as 32-bit, reduces size */
  float32?: boolean;

  /** use z85 encoding */
  z85?: boolean;

}
