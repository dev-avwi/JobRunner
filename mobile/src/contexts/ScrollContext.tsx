import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ScrollContextType {
  scrollToTopTrigger: number;
  triggerScrollToTop: () => void;
}

const ScrollContext = createContext<ScrollContextType | null>(null);

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [scrollToTopTrigger, setScrollToTopTrigger] = useState(0);
  
  const triggerScrollToTop = useCallback(() => {
    setScrollToTopTrigger(prev => prev + 1);
  }, []);
  
  return (
    <ScrollContext.Provider value={{ scrollToTopTrigger, triggerScrollToTop }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollToTop() {
  const context = useContext(ScrollContext);
  if (!context) {
    return { scrollToTopTrigger: 0, triggerScrollToTop: () => {} };
  }
  return context;
}
