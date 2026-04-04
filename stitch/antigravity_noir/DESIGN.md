# Design System Specification: The Weightless Frontier

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Void"**

This design system is built to evoke a sense of "Antigravity"—a digital environment where financial data feels weightless, fluid, and hyper-intelligent. We are moving away from the "Dashboard-as-a-Spreadsheet" mentality and toward a "Command Center" experience. 

To achieve a signature editorial feel, we utilize **The Kinetic Void** principle: large expanses of deep, void-like space (`surface-dim`) contrasted against high-energy kinetic elements (`primary`). We break the rigid, modular grid by using intentional asymmetry, overlapping glass surfaces, and a "tonal-first" approach to hierarchy. This is not just a dark mode; it is a deep-space interface designed for high-stakes precision.

---

## 2. Colors & Tonal Architecture
Financial interfaces often fail by becoming "noisy" with too many lines. In this system, we use light and depth, not strokes, to define structure.

### The Palette
- **Primary (Electric Blue):** `primary` (#92AAFF) and `primary-dim` (#3C6BED). This is your energy source. Use it sparingly for action and focus.
- **Surface Hierarchy:** 
    - Base: `surface` (#060E20)
    - Depth levels: `surface-container-low` (#091328) → `surface-container-high` (#141F38).
- **Semantics:** High-saturation `tertiary` (Green) for growth, `error` (Red) for risk, and `secondary-fixed` (Yellow) for warnings.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1x solid borders to section off content. Boundaries must be defined solely through:
1. **Background Shifting:** Placing a `surface-container-highest` card atop a `surface-dim` background.
2. **Negative Space:** Using the spacing scale to create distinct visual groupings.

### The "Glass & Gradient" Rule
Floating elements (Modals, Hover states, Sticky Navs) must use **Glassmorphism**. 
- **Style:** `surface-container-low` at 60% opacity with a 20px backdrop blur.
- **Signature Glow:** Apply a subtle `primary-dim` inner glow (1px, 10% opacity) to the top edge of glass cards to simulate light hitting the edge of a lens.

---

## 3. Typography: Editorial Authority
We use **Inter** for its mathematical precision and high legibility in dense data environments.

- **Display (The Statement):** `display-lg` (3.5rem) should be used for account totals or hero impact numbers. Use `-2%` letter spacing to make it feel "tight" and premium.
- **Headlines (The Anchor):** `headline-sm` (1.5rem) uses `on-surface` color. Use these to anchor sections without needing a divider line.
- **Body (The Utility):** `body-md` (0.875rem) is our workhorse. For secondary data, use `on-surface-variant` to create a natural hierarchy without changing font size.
- **Labels (The Metadata):** `label-sm` (0.6875rem) must always be Uppercase with `+5%` letter spacing to distinguish from body text.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are too "dirty" for a fintech app. We use **Ambient Luminosity**.

- **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` card nested inside a `surface-container-high` section creates a "sunken" effect, perfect for input fields.
- **Ambient Shadows:** When an object must float (e.g., a dropdown), use a shadow color of `#000000` at 40% alpha with a 40px blur. This mimics the depth of a dark room rather than a flat gray shadow.
- **The "Ghost Border" Fallback:** If a container requires definition against a similar background, use a 1px border of `outline-variant` at 15% opacity. It should be felt, not seen.

---

## 5. Components: High-Fidelity Primitives

### Buttons (Kinetic Actions)
- **Primary:** `primary` background with `on-primary` text. Apply a subtle `0 0 15px` glow using the `primary` token on hover.
- **Secondary:** Glass variant. `surface-variant` at 20% opacity with a `1px` ghost border.
- **Shape:** All buttons use the `xl` (1.5rem / 24px) roundedness scale for a soft, modern feel.

### Input Fields (The Sunken Well)
- **Base State:** `surface-container-lowest` background. No border. 
- **Active State:** A 1px bottom-border using `primary-fixed`. The label transitions from `body-md` to `label-sm` and shifts to `primary`.

### Cards & Lists (The Floating Grid)
- **Constraint:** Zero divider lines.
- **List Items:** Separate items using 8px of vertical space. On hover, the background should shift to `surface-bright` with a 400ms transition.
- **Interaction:** Cards should utilize a subtle "lift" on hover (TranslateY -4px) to emphasize the weightless theme.

### Data Visualization (The Pulse)
- Use `primary` for the main trend line. 
- Apply a `primary-container` gradient fill beneath the line with an opacity ramp from 20% to 0%.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `surface-container` shifts to create "zones" of information.
- **Do** use large amounts of white space (32px+) between major sections to let the "Dark Mode" breathe.
- **Do** use micro-interactions (e.g., a subtle 2% scale-up on a card) to reward user intent.

### Don't
- **Don't** use pure white (#FFFFFF) for text; use `on-surface` (#DEE5FF) to prevent eye strain.
- **Don't** use 100% opaque borders. They create "visual cages" that break the Antigravity feel.
- **Don't** use standard "Drop Shadows." Use tonal layering and luminosity.
- **Don't** overcrowd a single screen. If the data is dense, use progressive disclosure (collapsible glass panels).