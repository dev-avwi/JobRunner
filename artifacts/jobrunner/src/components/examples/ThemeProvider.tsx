import { ThemeProvider, useTheme } from '../ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sun, Moon, Monitor } from 'lucide-react';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-2">
      <Button
        variant={theme === 'light' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setTheme('light')}
      >
        <Sun className="h-4 w-4 mr-2" />
        Light
      </Button>
      <Button
        variant={theme === 'dark' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setTheme('dark')}
      >
        <Moon className="h-4 w-4 mr-2" />
        Dark
      </Button>
      <Button
        variant={theme === 'system' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setTheme('system')}
      >
        <Monitor className="h-4 w-4 mr-2" />
        System
      </Button>
    </div>
  );
}

function ThemeExample() {
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Theme Provider Example</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Try switching between different themes to see how the interface adapts.
          </p>
          <ThemeToggle />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ThemeProviderExample() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="example-theme">
      <div className="min-h-screen bg-background text-foreground">
        <ThemeExample />
      </div>
    </ThemeProvider>
  );
}