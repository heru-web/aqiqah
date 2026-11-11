---
name: Madani Heritage ERP
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3f4944'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6f7973'
  outline-variant: '#bec9c2'
  surface-tint: '#1b6b51'
  primary: '#004532'
  on-primary: '#ffffff'
  primary-container: '#065f46'
  on-primary-container: '#8bd6b7'
  inverse-primary: '#8bd6b6'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#004530'
  on-tertiary: '#ffffff'
  tertiary-container: '#005f44'
  on-tertiary-container: '#7cd9b1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f2d1'
  primary-fixed-dim: '#8bd6b6'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513b'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#97f5cc'
  tertiary-fixed-dim: '#7bd8b1'
  on-tertiary-fixed: '#002115'
  on-tertiary-fixed-variant: '#00513a'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  title-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system pairs the sacred trust and solemnity of Islamic aqiqah traditions with the operational precision of an enterprise resource planning platform. Designed for livestock procurement teams, butcheries, commercial kitchens, quality assurance inspectors, and logistics dispatchers, the aesthetic blends modern technical minimalism with refined heritage depth.

The interface prioritizes operational dignity, utmost legibility under time-sensitive fulfillment cycles, and high-density tracking. Visual elements draw inspiration from classical geometry and natural earthtones: deep forest emerald represents life, barakah, and compliance; warm gold signals sacred milestones and attention; and balanced slate foundations ground the administrative workspace. The UI projects poise, immutability, and logistical authority without ever feeling cold or detached.

## Colors

The palette is engineered for prolonged operational use in both brightly lit abattoir/kitchen terminals and administrative back-offices.

### Core Swatches
- **Primary (`#065F46`)**: Heritage Forest Emerald. Used for primary calls to action, active navigation indicators, key audit stamps, and verified certificates.
- **Secondary (`#D97706`)**: Warm Burnished Gold. Reserved for critical transactional flags, high-tier order designations, prayer/timing alerts, and pending halal reviews.
- **Tertiary (`#047857`)**: Vibrant Emerald Accent. Leveraged for positive confirmation states, progress completion meters, and metric trend indicators.
- **Neutral (`#0F172A`)**: Deep Slate Obsidian. Used for high-contrast primary text, table headers, and structural UI chrome.

### Background & Surface Hierarchy
- **Canvas (`#F8FAFC`)**: Soft warm slate base.
- **Sub-canvas (`#F1F5F9`)**: Dense table rows, inactive tabs, and segmented control backgrounds.
- **Surface Elevation (`#FFFFFF`)**: Card containers, floating dialogs, and flyout drawer bodies.
- **Structural Border (`#E2E8F0`)**: Low-strain dividing lines.
- **Warm Border Accent (`#E5E0D8`)**: Contextual divider used on high-profile certification panels and receipt summaries.

### Order Pipeline Status Tokens
- **CONFIRMED**: Surface `#EFF6FF`, Border `#BFDBFE`, Text `#1D4ED8` (Blue)
- **SLAUGHTERED**: Surface `#ECFDF5`, Border `#A7F3D0`, Text `#065F46` (Forest Emerald)
- **COOKED**: Surface `#FFFBEB`, Border `#FDE68A`, Text `#B45309` (Amber)
- **PACKED**: Surface `#F5F3FF`, Border `#DDD6FE`, Text `#6D28D9` (Purple)
- **QC_READY**: Surface `#ECFEFF`, Border `#A5F3FC`, Text `#0E7490` (Teal)
- **IN_TRANSIT**: Surface `#FFF7ED`, Border `#FFEDD5`, Text `#C2410C` (Orange)
- **DELIVERED**: Surface `#F0FDF4`, Border `#BBF7D0`, Text `#15803D` (Green)

## Typography

The type system blends contemporary Swiss structure with technical precision. 

- **Primary & Headings (`Hanken Grotesk`)**: Provides geometric clarity, tall x-height, and neutral authority across dashboard titles, form inputs, and metrics.
- **Data & Tracking Labels (`JetBrains Mono`)**: Applied to all order identification keys (e.g., `ORD-2024-AQ-891`), carcass weights, batch IDs, vehicle plate numbers, and timestamp audits to ensure zero ambiguous digits.

All numbers in enterprise tables must enforce tabular lining figures (`font-variant-numeric: tabular-nums;`) to maintain strict vertical alignment across columns.

## Layout & Spacing

The platform is constructed on a 12-column fluid grid system pinned to a maximum canvas constraint of `1680px` for wide terminal operation.

### Breakpoints & Adaptive Flow
- **Desktop (>= 1280px)**: 12 columns, `1.5rem` (`24px`) gutters, `2rem` (`32px`) margins. Sidebar is permanently expanded (`260px` fixed).
- **Tablet / Operational Terminal (768px – 1279px)**: 8 columns, `1rem` (`16px`) gutters, `1.5rem` (`24px`) margins. Sidebar collapses to an icon dock (`64px` fixed). Data tables toggle horizontal scroll locks with fixed left identification columns.
- **Mobile (<= 767px)**: 4 columns, `0.75rem` (`12px`) gutters, `1rem` (`16px`) margins. Multi-column tables collapse into vertical operational cards with stacked state timelines.

### Rhythmic Padding System
- **Dense Data Cells**: `0.5rem` vertical by `0.75rem` horizontal padding.
- **Standard Cards & Form Modules**: `1.25rem` to `1.5rem` internal padding.
- **KPI / Stat Panels**: `1rem` vertical by `1.25rem` horizontal padding.

## Elevation & Depth

To avoid visual friction in dense operational workflows, this system relies on low-contrast structural outlines and subtle tonal depth rather than heavy drop shadows.

- **Level 0 (Floor/Canvas)**: `#F8FAFC` base surface, flat.
- **Level 1 (Card & Module Layer)**: Pure white `#FFFFFF` surface bounded by a continuous `1px solid #E2E8F0` border. Shadow is an ambient, faint veil: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Hovered Rows / Popovers / Active Dropdowns)**: Elevated surface with `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` and `border: 1px solid #CBD5E1`.
- **Level 3 (Modals / Slide-Over Drawers)**: Deep slate ambient presence: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`, framed with a backdrop overlay of `rgba(15, 23, 42, 0.45)` with `backdrop-filter: blur(2px)`.
- **Accent Highlight Elevation**: High-significance panels (such as Halal Certification and Sharia Slaughter Witnessing Logs) swap the default border for `#E5E0D8` (Warm Stone) with a subtle top edge accent in `#065F46`.

## Shapes

The interface utilizes a disciplined, soft corner treatment (`roundedness: 1`). 

- **Micro Components (Badges, Chips, Inline Tags)**: `0.25rem` (`4px`) radius to retain crisp alignment alongside dense tabular lines.
- **Interactive Controls (Buttons, Text Inputs, Selects)**: `0.375rem` (`6px`) radius for a dependable, tactile feel.
- **Containers (Panels, Data Grids, Metric Cards)**: `0.5rem` (`8px`) radius (`rounded-lg`).
- **Modal Windows & Slide-over Panes**: `0.75rem` (`12px`) radius (`rounded-xl`).
- **Pill Exceptions**: Solely reserved for live GPS operational indicators and micro status dots (`9999px`).

## Components

### Buttons
- **Primary Action**: Solid `#065F46` background, `#FFFFFF` text, `1px solid transparent`. Active/Hover: `#047857`. Focus ring: `2px` offset with `#065F46`.
- **Secondary Action**: Solid `#FFFFFF` background, `#0F172A` text, `1px solid #E2E8F0`. Hover: `#F8FAFC` background with border `#CBD5E1`.
- **Critical / Sacred Action** (e.g., *Log Slaughtering Protocol*): Deep emerald base with an interior `2px` inline accent in `#D97706`.
- **Ghost Action**: Transparent background, `#475569` text. Hover: `#F1F5F9`.

### Badges & Status Indicators
Badges are compact (`padding: 2px 8px`), using `JetBrains Mono` at `11px`, semi-bold uppercase, with a `4px` border radius and a delicate `1px` tinted border:
- `CONFIRMED`: Blue tint, representing confirmed booking and payment.
- `SLAUGHTERED`: Rich emerald tint, certifying completion of syariah slaughtering.
- `COOKED`: Amber tint, indicating kitchen processing (gulai, sate, teriyaki).
- `PACKED`: Indigo tint, signifying thermal box sealing and labeling.
- `QC_READY`: Cyan tint, confirming scale weight verification and QA sign-off.
- `IN_TRANSIT`: Orange tint, actively linked to logistics courier assignment.
- `DELIVERED`: Kelly green tint, confirming recipient doorstep handoff and documentation capture.

### Enterprise Data Tables
- **Header**: `#F8FAFC` background, `0.75rem` vertical padding, text styled as `caption` in `#475569`, uppercase with `letter-spacing: 0.05em`. Bottom border: `1px solid #E2E8F0`.
- **Rows**: `#FFFFFF` background with alternating or hover highlight of `#F8FAFC`. Height fixed at `44px` for high-density operation. Bottom border: `1px solid #F1F5F9`.
- **Numeric & ID Cells**: Left or right-aligned using `JetBrains Mono` with tabular numeric figures.

### Form Inputs
- **Base Input**: `#FFFFFF` background, `1px solid #CBD5E1`, text `#0F172A`. Inner padding: `8px 12px`. Placeholder: `#94A3B8`.
- **Focus State**: Border switches to `#065F46` with a `3px` outer ring in `rgba(6, 95, 70, 0.15)`.
- **Disabled State**: `#F1F5F9` background, `#94A3B8` border, non-interactive cursor.

### Cards & Metrics (KPI Tiles)
- Surface is `#FFFFFF` with a `1px solid #E2E8F0` border.
- Includes a subtle indicator notch (`3px` high) on the card's top rim colored in primary emerald or warm amber depending on the metric category.
- Metric values use `display-lg` (`36px`) paired with a muted micro-label underneath.

### Checkboxes & Radios
- Square (`checkbox`) and circle (`radio`) controls with `1px solid #CBD5E1`. Checked state: solid `#065F46` fill with an optical white glyph. Focus outlines honor the standard emerald ring token.