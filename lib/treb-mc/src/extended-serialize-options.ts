
import { SerializeOptions } from 'treb-grid';

export interface ExtendedSerializeOptions extends SerializeOptions {

  preserve_simulation_data?: boolean;

  /** save simulation data as 32-bit, reduces size */
  use_float32?: boolean;

  /** use z85 encoding */
  use_z85?: boolean;

}
