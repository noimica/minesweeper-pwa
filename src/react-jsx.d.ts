// Temporary declarations to satisfy TypeScript when @types/react is not installed.
// Prefer installing @types/react and @types/react-dom instead of relying on this file.
declare module 'react/jsx-runtime' {
  export * from 'react';
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
