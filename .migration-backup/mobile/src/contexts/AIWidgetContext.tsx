import { createContext, useContext, useState, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { FloatingAIWidget, FloatingAIButton } from '../components/FloatingAIWidget';
import { useUserRole } from '../hooks/use-user-role';

interface AIWidgetContextType {
  isOpen: boolean;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
}

const AIWidgetContext = createContext<AIWidgetContextType | undefined>(undefined);

export function useAIWidget() {
  const context = useContext(AIWidgetContext);
  if (!context) {
    throw new Error('useAIWidget must be used within AIWidgetProvider');
  }
  return context;
}

interface AIWidgetProviderProps {
  children?: ReactNode;
}

export function AIWidgetProvider({ children }: AIWidgetProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { canUseAIFeatures } = useUserRole();

  const openWidget = () => setIsOpen(true);
  const closeWidget = () => setIsOpen(false);
  const toggleWidget = () => setIsOpen(prev => !prev);

  return (
    <AIWidgetContext.Provider value={{ isOpen, openWidget, closeWidget, toggleWidget }}>
      {children}
      {canUseAIFeatures && (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {!isOpen && <FloatingAIButton onPress={openWidget} />}
        <FloatingAIWidget isVisible={isOpen} onClose={closeWidget} />
      </View>
      )}
    </AIWidgetContext.Provider>
  );
}
