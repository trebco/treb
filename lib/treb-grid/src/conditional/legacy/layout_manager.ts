
import { GridLayout } from '../../layout/grid_layout';
import { LegacyLayout } from '../../layout/legacy_layout';
import { UA } from '../../util/ua';
import { DataModel } from '../../types/data_model';
import { BaseLayout } from '../../layout/base_layout';

// console.info("conditional create layout");

import '../../../style/legacy-layout.scss';
import '../../../style/grid-layout.scss';

export const CreateLayout = (model: DataModel): BaseLayout => {
  return UA.is_modern ?
    new GridLayout(model) :
    new LegacyLayout(model);
}
