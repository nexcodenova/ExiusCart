// Tremor Raw helper — recalculates the chart legend's height whenever the
// window resizes (a wrapped/multi-line legend needs a different reserved
// height at different widths).
import { useEffect } from 'react';

export const useOnWindowResize = (handler: { (): void }) => {
  useEffect(() => {
    const handleResize = () => {
      handler();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
