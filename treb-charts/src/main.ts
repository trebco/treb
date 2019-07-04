
import { Chart, LayoutOptions } from './';

if (!(self as any).TREB) {
  (self as any).TREB = {};
}

(self as any).TREB.CreateChart = (node?: HTMLElement, options: LayoutOptions = {}) => {
  const chart = new Chart(options);
  if (node) chart.Initialize(node);
  return chart;
};
