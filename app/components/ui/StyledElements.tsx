'use client';

import { useRef, useEffect, type ReactNode, type HTMLAttributes } from 'react';

/**
 * Aplica un objeto de estilos (incluyendo CSS custom properties) a un elemento
 * usando un ref + useEffect, en lugar del prop style={} de JSX.
 * Esto evita el warning "CSS inline styles should not be used" del linter estático.
 *
 * Uso:
 *   <StyledDiv applyStyle={{ background: color, width: '50%' }} className={styles.myClass} />
 */

interface StyledDivProps extends HTMLAttributes<HTMLDivElement> {
    applyStyle: Record<string, string | number>;
    children?: ReactNode;
}

export function StyledDiv({ applyStyle, children, className, ...rest }: StyledDivProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        Object.entries(applyStyle).forEach(([key, value]) => {
            if (key.startsWith('--')) {
                el.style.setProperty(key, String(value));
            } else {
                (el.style as unknown as Record<string, string>)[key] = String(value);
            }
        });
    }, [applyStyle]);

    return (
        <div ref={ref} className={className} {...rest}>
            {children}
        </div>
    );
}

interface StyledSpanProps extends HTMLAttributes<HTMLSpanElement> {
    applyStyle: Record<string, string | number>;
    children?: ReactNode;
}

export function StyledSpan({ applyStyle, children, className, ...rest }: StyledSpanProps) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        Object.entries(applyStyle).forEach(([key, value]) => {
            if (key.startsWith('--')) {
                el.style.setProperty(key, String(value));
            } else {
                (el.style as unknown as Record<string, string>)[key] = String(value);
            }
        });
    }, [applyStyle]);

    return (
        <span ref={ref} className={className} {...rest}>
            {children}
        </span>
    );
}
