
import { GridLayout } from '../../layout/grid_layout';
import { DataModel } from '../../types/data_model';
import { BaseLayout } from '../../layout/base_layout';

import '../../../style/grid-layout.scss';

export const CreateLayout = (model: DataModel): BaseLayout => new GridLayout(model);

