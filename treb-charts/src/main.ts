
import { Chart, LayoutOptions } from './';

if (!(self as any).TREB) {
  (self as any).TREB = {};
}

// (temporarily, atm) switching name to prevent overlap

(self as any).TREB.CreateChart2 = (node?: HTMLElement, options: LayoutOptions = {}) => {
  const chart = new Chart(options);
  if (node) chart.Initialize(node);
  return chart;
};
