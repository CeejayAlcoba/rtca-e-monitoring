import { useState, useEffect } from "react";
import { Grid } from "antd";

const { useBreakpoint } = Grid;

export function useResponsiveLayout(mobileBreakpoint = 768) {
  const screens = useBreakpoint();
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      // Check both via window width and Antd's screen breakpoint as a fallback
      const currentIsMobile =
        window.innerWidth < mobileBreakpoint || !!screens.xs;
      setIsMobile(currentIsMobile);
    };

    // Run on initial mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [screens.xs, mobileBreakpoint]);

  return {
    isMobile,
    screens, // Exposes all antd breakpoints (xs, sm, md, lg, xl) if needed elsewhere
  };
}
