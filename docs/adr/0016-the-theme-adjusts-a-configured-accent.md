# The theme adjusts a configured accent rather than trusting it

Site owners configure colours as plain values — `#3388FF`, `rgba(51, 136, 255, 1)`, `oklch(0.64 0.19 258)` — and the theme layer converts them into the full set of custom properties the interface uses. Where a configured accent would produce unreadable text, **the accent is moved until the text is readable, and the adjustment is reported back**.

The alternative was to accept whatever was configured. That fails quietly: a mid-tone blue looks perfectly good in a colour picker and produces a button whose label nobody can read. Contrast failures are invisible to the person who caused them, which is exactly the class of mistake that should not be left to care and attention.

## Considered Options

- **Trust the configured value.** Simplest, and honest about who is in charge. Rejected because the failure is silent and lands on readers rather than on the operator who chose the colour.
- **Reject a value that cannot be made readable.** Keeps the stored value truthful. Rejected because it turns a solvable problem into a dead end during setup, with no obvious next step for the operator.
- **Adjust the accent and report it** (adopted): the configured hue and chroma are preserved, lightness is reduced in small steps until the label clears WCAG AA, and the resolution names every token it had to move.

## The label colour is not configurable

Text on the accent is always the light foreground, and the accent moves to accommodate it. This is not the mathematically optimal choice — a mid blue often scores better against near-black text — but a blue button with dark text reads as a mistake regardless of what the numbers say. Convention wins, and the accent is what gives way.

For the same reason `primary-foreground` is derived rather than settable. Offering it as a setting would invite exactly the combination this decision exists to prevent.

## Consequences

**A configured colour is not always the rendered colour.** The default accent `#3388FF` is darkened before it is used. The resolution reports which tokens moved so the admin interface can say so plainly; without that, an operator would reasonably conclude the setting was broken.

Colour maths runs on the server when a theme is resolved, not in the browser on every render, so the cost falls on the rare write rather than the common read.

The build pipeline emits an sRGB hex fallback alongside each wide-gamut value. **Those fallbacks are what most contrast checks and older browsers actually see**, so a change to the accent is verified against the fallback and not only against the authored value.

Only tokens the interface treats as themeable are accepted; anything else in a stored theme is ignored rather than passed through to CSS, so a malformed or hostile settings row cannot inject arbitrary declarations.
