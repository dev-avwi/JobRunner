// Minimal local declarations for react-test-renderer (used only in Jest
// tests). The package ships no types and @types/react-test-renderer isn't
// installable in this environment (mobile npm installs are firewalled), so we
// declare just the surface our tests use.
declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export interface ReactTestInstance {
    type: string | Function;
    props: { [propName: string]: any };
    parent: ReactTestInstance | null;
    children: Array<ReactTestInstance | string>;
    find(predicate: (node: ReactTestInstance) => boolean): ReactTestInstance;
    findAll(
      predicate: (node: ReactTestInstance) => boolean,
      options?: { deep: boolean },
    ): ReactTestInstance[];
    findByType(type: string | Function): ReactTestInstance;
    findAllByType(type: string | Function): ReactTestInstance[];
    findByProps(props: { [propName: string]: any }): ReactTestInstance;
    findAllByProps(props: { [propName: string]: any }): ReactTestInstance[];
  }

  export interface ReactTestRenderer {
    root: ReactTestInstance;
    toJSON(): any;
    update(nextElement: ReactElement): void;
    unmount(): void;
  }

  export function create(element: ReactElement): ReactTestRenderer;
  export function act(callback: () => Promise<void> | void): Promise<void>;
}
