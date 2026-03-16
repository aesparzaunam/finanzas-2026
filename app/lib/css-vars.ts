import type React from 'react';

/**
 * Helper type para pasar CSS custom properties (variables) como inline styles
 * sin necesidad de usar `as any`. React.CSSProperties no incluye custom properties
 * por diseño, así que este tipo las añade de forma segura.
 */
export interface CSSWithVars extends React.CSSProperties {
    [cssVar: `--${string}`]: string | number | undefined;
}
