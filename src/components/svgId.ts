import { useId } from 'react';

/** Unique, url()-safe id for SVG defs (gradients, masks), so two copies of a drawing never share one. */
export function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9]/g, '');
}
