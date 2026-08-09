import { useEffect, useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Shortcut {
  keys: string[];
  description: string;
  action: () => void;
  category: 'navigation' | 'actions' | 'general';
}

export function useKeyboardShortcuts() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: Shortcut[] = [
    { keys: ['g', 'h'], description: 'Go to Dashboard', action: () => navigate('/'), category: 'navigation' },
    { keys: ['g', 'j'], description: 'Go to Jobs', action: () => navigate('/work'), category: 'navigation' },
    { keys: ['g', 'c'], description: 'Go to Clients', action: () => navigate('/clients'), category: 'navigation' },
    { keys: ['g', 'd'], description: 'Go to Documents', action: () => navigate('/documents'), category: 'navigation' },
    { keys: ['g', 'q'], description: 'Go to Quotes', action: () => navigate('/quotes'), category: 'navigation' },
    { keys: ['g', 'i'], description: 'Go to Invoices', action: () => navigate('/invoices'), category: 'navigation' },
    { keys: ['g', 't'], description: 'Go to Team', action: () => navigate('/team-operations'), category: 'navigation' },
    { keys: ['g', 'm'], description: 'Go to Map', action: () => navigate('/map'), category: 'navigation' },
    { keys: ['g', 's'], description: 'Go to Settings', action: () => navigate('/settings'), category: 'navigation' },
    { 
      keys: ['n', 'j'], 
      description: 'New Job', 
      action: () => navigate('/jobs/new'), 
      category: 'actions' 
    },
    { 
      keys: ['n', 'c'], 
      description: 'New Client', 
      action: () => navigate('/clients/new'), 
      category: 'actions' 
    },
    { 
      keys: ['n', 'q'], 
      description: 'New Quote', 
      action: () => navigate('/quotes/new'), 
      category: 'actions' 
    },
    { 
      keys: ['n', 'i'], 
      description: 'New Invoice', 
      action: () => navigate('/invoices/new'), 
      category: 'actions' 
    },
    { 
      keys: ['?'], 
      description: 'Show keyboard shortcuts', 
      action: () => setShowHelp(true), 
      category: 'general' 
    },
    { 
      keys: ['Escape'], 
      description: 'Close dialogs', 
      action: () => setShowHelp(false), 
      category: 'general' 
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isInputFocused = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable;

    if (isInputFocused && event.key !== 'Escape') {
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      setShowHelp(true);
      return;
    }

    if (event.key === 'Escape') {
      setShowHelp(false);
      return;
    }
  }, []);

  useEffect(() => {
    let keySequence: string[] = [];
    let sequenceTimeout: NodeJS.Timeout;

    const handleKeySequence = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || 
                             target.tagName === 'TEXTAREA' || 
                             target.isContentEditable;

      if (isInputFocused && event.key !== 'Escape') {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      clearTimeout(sequenceTimeout);

      keySequence.push(event.key.toLowerCase());

      const matchingShortcut = shortcuts.find(shortcut => {
        if (shortcut.keys.length === 1) {
          return shortcut.keys[0] === event.key;
        }
        return shortcut.keys.every((key, index) => keySequence[index] === key.toLowerCase());
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
        keySequence = [];
        return;
      }

      sequenceTimeout = setTimeout(() => {
        keySequence = [];
      }, 500);
    };

    window.addEventListener('keydown', handleKeySequence);
    return () => {
      window.removeEventListener('keydown', handleKeySequence);
      clearTimeout(sequenceTimeout);
    };
  }, [shortcuts]);

  return { showHelp, setShowHelp, shortcuts };
}

export function KeyboardShortcutsDialog() {
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts();

  const navigationShortcuts = shortcuts.filter(s => s.category === 'navigation');
  const actionShortcuts = shortcuts.filter(s => s.category === 'actions');
  const generalShortcuts = shortcuts.filter(s => s.category === 'general');

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate quickly
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Navigation</h4>
              <div className="space-y-2">
                {navigationShortcuts.map((shortcut, index) => (
                  <ShortcutItem key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">Quick Actions</h4>
              <div className="space-y-2">
                {actionShortcuts.map((shortcut, index) => (
                  <ShortcutItem key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">General</h4>
              <div className="space-y-2">
                {generalShortcuts.map((shortcut, index) => (
                  <ShortcutItem key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <Badge variant="outline" className="mx-1 text-xs">?</Badge> anytime to show this help
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutItem({ shortcut }: { shortcut: Shortcut }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {shortcut.keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <Badge variant="outline" className="font-mono text-xs px-2">
              {key === 'Escape' ? 'Esc' : key.toUpperCase()}
            </Badge>
            {index < shortcut.keys.length - 1 && (
              <span className="text-muted-foreground text-xs">then</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <KeyboardShortcutsDialog />
    </>
  );
}
