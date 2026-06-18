---
name: HelloCal
description: Intelligent Voice Calorie Tracker
colors:
  primary: "#8b5cf6"
  neutral-bg: "#0a0b10"
  neutral-surface: "#131520"
  neutral-text: "#f8fafc"
  neutral-text-secondary: "#aab6c7"
  neutral-text-muted: "#7e8ca1"
  neutral-slate: "#64748b"
  accent-purple: "#8b5cf6"
  accent-teal: "#10b981"
  accent-blue: "#06b6d4"
  accent-amber: "#f59e0b"
  accent-rose: "#f43f5e"
  accent-rose-light: "#fda4af"
  accent-cyan: "#38bdf8"
  bg-overlay: "rgba(4, 5, 8, 0.85)"
  bg-glass-light: "rgba(255, 255, 255, 0.03)"
  bg-glass-medium: "rgba(255, 255, 255, 0.05)"
  bg-glass-thick: "rgba(255, 255, 255, 0.1)"
  bg-glass-focus: "rgba(255, 255, 255, 0.06)"
  bg-glass-handle: "rgba(255, 255, 255, 0.18)"
  bg-glass-active: "rgba(255, 255, 255, 0.12)"
  border-glass-active: "rgba(255, 255, 255, 0.2)"
  accent-rose-hover: "#e11d48"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, sans-serif"
    fontWeight: 400
rounded:
  xs: "6px"
  sm: "8px"
  sm-md: "10px"
  md: "12px"
  md-lg: "14px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  pill: "30px"
spacing:
  container: "24px"
  element: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent-purple}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.bg-glass-medium}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  input-field:
    backgroundColor: "{colors.bg-glass-light}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "12.8px 16px"
  nav-tabs:
    backgroundColor: "{colors.bg-glass-light}"
    rounded: "{rounded.pill}"
    padding: "4px"
---

# Design System: HelloCal

## 1. Overview

**Creative North Star: "The Obsidian Console"**

HelloCal is styled as a premium, tactical, glass-layered console designed for rapid, on-the-go food and supplement logging. The interface feels like a sleek, dark instrument panel where information is grouped on floating glass translucent plates and focused with precise neon indicator glows. This design centers around speed, minimizing cognitive load for daily trackers, and establishing a professional, high-fidelity dark mode.

**Key Characteristics:**
- **Obsidian Dark Foundation**: Deep, immersive black surfaces prevent glare and look extremely premium.
- **Glassmorphic Layering**: Components sit on translucent glass cards using backdrop blurs and subtle borders to stack information cleanly.
- **Neon Indicator Glows**: Vibrant accents function as interactive markers and telemetry indicators, rather than pure decoration.

## 2. Colors

The color palette is characterized by "Obsidian Abyss & Starlight White with Neon Aura accents" (vibrant neon purples, teals, and roses contrasted against a rich deep black backdrop).

### Primary
- **Aura Purple** (#8b5cf6): The main brand accent. Used for primary call-to-actions, active navigation states, and focus rings.

### Secondary
- **Aura Teal** (#10b981): Used for positive logging milestones, completed streaks, or healthy nutritional balances.

### Tertiary
- **Aura Rose** (#f43f5e): Reserved for high-alert items, over-budget warnings, and delete actions.

### Neutral
- **Obsidian Abyss** (#0a0b10): The primary background color of the application window.
- **Midnight Surface** (#131520): The secondary background color for side drawers and card layouts.
- **Starlight White** (#f8fafc): High-contrast primary body text color, ensuring excellent readability.
- **Muted Steel** (#aab6c7): Secondary text color for helper text and secondary labels.

### Named Rules
**The Neon Restriction Rule.** Neon accents (Purple, Teal, Rose, Blue, Amber) must be restricted to interactive states, active indicators, and focus outlines. They must occupy ≤10% of any screen surface to preserve their value as visual indicators.

## 3. Typography

**Display Font:** Outfit (sans-serif)
**Body Font:** Inter (sans-serif)

**Character:** A pairing of a bold, clean geometric display face (Outfit) for high-impact numbers and headings, with a highly legible, neutral grotesque face (Inter) for labels and tracking data.

### Hierarchy
- **Display** (600, clamp(1.75rem, 5vw, 3rem), 1.2): Large metric readouts (e.g. calorie totals) and page headers.
- **Headline** (600, 1.5rem, 1.3): Major card titles and section headers.
- **Title** (500, 1.1rem, 1.4): Small card labels and modal headers.
- **Body** (400, 1rem, 1.5): Standard descriptive text, table cells, and form entries.
- **Label** (500, 0.85rem, 1.2): Tab buttons, pill labels, and small units/times.

### Named Rules
**The Balanced Headline Rule.** Display and Headline typography must use `text-wrap: balance` to prevent awkward word wrapping and orphan lines on narrow mobile screens.

## 4. Elevation

Elevation is achieved through layered glassmorphism, translucency, and glow offsets rather than traditional physical shadows.

### Shadow Vocabulary
- **Interactive Aura Glow** (`0 0 15px rgba(139, 92, 246, 0.4)`): Applied only during active hover or focus states on primary buttons and indicators.
- **Atmospheric Card Shadow** (`0 8px 32px 0 rgba(0, 0, 0, 0.3)`): Soft black shadow cast by glassmorphic panels to detach them from the background canvas.

### Named Rules
**The Glass-Depth Rule.** Avoid solid colored overlays. Surfaces must use backdrop blurs (`backdrop-filter: blur(16px)`) and thin borders (`rgba(255, 255, 255, 0.06)`) to stack vertically, ensuring the background radial gradients gently shine through.

## 5. Components

### Buttons
- **Shape:** Gently rounded corner (12px radius).
- **Primary:** Aura Purple (#8b5cf6) background with Starlight White text and 12px 24px padding.
- **Hover / Focus:** Aura Purple Glow (`0 0 20px rgba(139, 92, 246, 0.6)`) and a slight push scale scale(0.97) on active touch.

### Cards / Containers
- **Corner Style:** Curved corners (20px radius).
- **Background:** Translucent Obsidian glass (`rgba(19, 21, 32, 0.7)`) with backdrop blur (16px).
- **Border:** Thin translucent divider (`1px solid rgba(255, 255, 255, 0.06)`).

### Inputs / Fields
- **Style:** Dark field (`rgba(255, 255, 255, 0.03)`) with 12px radius and 1px border.
- **Focus:** Border transitions to Aura Purple with a soft glow.

### Navigation (Tabs)
- **Style:** Capsule container (`border-radius: 30px`, `padding: 4px`) with buttons inside.
- **Active state:** Pill background transitions to Aura Purple with purple glow.
- **Mobile treatment:** Becomes a fixed bottom navigation bar on screens under 768px.

## 6. Do's and Don'ts

### Do:
- **Do** use `prefers-reduced-motion` queries to immediately disable or simplify spring transitions for users who request it.
- **Do** test text readability on background gradients to ensure contrast stays above 4.5:1.
- **Do** scale touch targets to ≥44px on mobile screens.

### Don't:
- **Don't** use warm, saturated AI-cream/beige/sand SaaS templates or naming schemes.
- **Don't** construct flat, plain gray layouts with no lighting or tactical visual hierarchy.
- **Don't** employ over-the-top, distracting cyberpunk aesthetics that hurt readability and usability.
- **Don't** build bright, clinical, hospital-like white spreadsheets.
- **Don't** use colored left/right stripes on cards.
- **Don't** hover-animate image elements.
