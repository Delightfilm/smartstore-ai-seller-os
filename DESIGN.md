---
name: Seller OS
description: Calm, image-led procurement review for DelightFilm
colors:
  accent: "#1E4D3D"
  accent-fg: "#FFFFFF"
  accent-soft: "#E9F1EC"
  accent-line: "#A4C2B1"
  bg: "#F8F9F6"
  surface: "#FFFFFF"
  surface-2: "#F2F5F1"
  line: "#E0E6E1"
  line-strong: "#BCCAC2"
  text: "#182C25"
  text-2: "#526159"
  warn: "#9A6410"
  warn-soft: "#FDF3E2"
  neg: "#C4362F"
  dark-accent: "#A4D2B5"
  dark-accent-fg: "#13241A"
  dark-accent-soft: "#233E2D"
  dark-accent-line: "#496D56"
  dark-bg: "#111A16"
  dark-surface: "#17231D"
  dark-surface-2: "#1E2C25"
  dark-line: "#314639"
  dark-line-strong: "#4B6657"
  dark-text: "#EDF4EF"
  dark-text-2: "#B2C3B8"
  dark-warn: "#D9A03F"
  dark-warn-soft: "#261D0C"
  dark-neg: "#F0736A"
typography:
  headline:
    fontFamily: 'ui-sans-serif, -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif'
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'ui-sans-serif, -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 650
  body:
    fontFamily: 'ui-sans-serif, -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: 'ui-sans-serif, -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 650
  number:
    fontFamily: 'ui-sans-serif, -apple-system, "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 650
rounded:
  control: "8px"
  navigation: "12px"
  card: "14px"
  image: "9px"
  status: "6px"
  warning: "10px"
spacing:
  compact: "6px"
  control: "10px"
  row: "12px"
  gallery: "14px"
  section: "18px"
  workspace: "20px"
  heading: "24px"
  page: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "40px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.navigation}"
    padding: "10px 3px"
  candidate-status:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    rounded: "{rounded.status}"
    padding: "4px 8px"
    typography: "{typography.label}"
  candidate-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "9px"
  candidate-inspector:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "18px"
  disclosure:
    textColor: "{colors.text-2}"
    size: "12px"
---

# Design System: Seller OS

## Overview

**Creative North Star: "The Procurement Workbench"**

A calm procurement workbench: warm stone grounds, white surfaces, and forest green for actions and selection. The system supports PC comparison of stored product evidence with standard controls and quiet borders.

The chosen C direction gives real product images room without turning the interface into a promotion. System fonts are intentional workhorse typography. Missing images and unresolved economics remain legible parts of the review.

**Key Characteristics:**

- Warm stone and white surfaces
- Forest green action and selection
- Actual stored imagery with explicit fallback
- Compact evidence and aligned financial values

## Colors

Forest green sits against warm stone and white; amber and red carry review warnings and negative values.

### Primary

- **Forest Green** (`accent`): primary actions, selected rail items, selected card borders, and focus.
- **Soft Sage** (`accent-soft`, `accent-line`): selected backgrounds, hover borders, and field focus halo.
- **Action Foreground** (`accent-fg`): text and icons on the primary action.

### Neutral

- **Warm Stone** (`bg`): application ground.
- **White Surface / Mist Surface** (`surface`, `surface-2`): cards, inspector, input fill, image ground, and quiet hover.
- **Quiet Line / Strong Line** (`line`, `line-strong`): containers and stronger separation.
- **Forest Ink / Secondary Ink** (`text`, `text-2`): titles and supporting evidence.

Amber (`warn`, `warn-soft`) marks hold and review messages. Red (`neg`) marks negative economics. These are semantic colors, not extra brand accents.

Dark mode uses the corresponding `dark-*` primitives with the same roles; source theme variables are defined in `src/SmartStoreSellerOS.jsx`. This frontmatter records the reusable C subset, not every legacy grade or one-off color.

**The Evidence Rule.** Image presence never implies usage rights, profitability, or transaction readiness.

## Typography

**Display and Body Font:** the shared UI sans-serif system stack in the frontmatter. Pretendard is a local fallback name, not a downloaded font. **Label/Mono Font:** identifiers may use the existing `ui-monospace, "SF Mono", Menlo, monospace` utility.

The hierarchy is compact and practical. Financial values use `font-variant-numeric: tabular-nums`.

- **Headline:** page title; reduces to (24px) at the mobile breakpoint.
- **Title:** inspector heading. Product titles use (14px), weight (650), line-height (1.5); cards clamp to two lines.
- **Body:** shared application text.
- **Label:** candidate status; supporting metadata uses (11–12px).
- **Number:** inspector financial values; card estimates use (15px), summary counts (23px).

## Layout

The shell uses a narrow navigation rail, a desktop top bar (64px), and a main area capped at (1920px) with page padding from the frontmatter. The C discovery surface places the candidate grid beside an inspector at `minmax(310px, 32%)`, separated by the workspace spacing token. The inspector sticks below the header at (84px).

Cards use three equal columns; at (1270px) and below the desktop grid becomes two columns. At (1000px) and below the inspector moves beneath the grid and the grid returns to three columns. At (720px) and below it becomes two columns, image frames become square, page padding becomes (14px), the rail becomes (68px), and the header becomes (56px). At (420px) and below cards form one column. The document minimum width is (320px).

Search spans available toolbar width; native status/sort selects and refresh sit alongside it. On mobile the toolbar wraps and search occupies its own row. Research settings and full records use native disclosures. Long names wrap; tables retain horizontal scrolling rather than crushing columns.

## Elevation & Depth

The C gallery is flat at rest. Surface tone, a single border, and a green selected outline establish hierarchy; the inspector gains continuity through sticky placement rather than a decorative shadow. The shared shell retains low and large shadow variables for existing surfaces. Exact shadow and motion values live in the sidecar.

## Shapes

Controls have gently curved corners; navigation is rounder and cards/inspector share the broadest recurring corners. Images sit within their own clipped frame. Use the frontmatter radius roles rather than giving every surface the same silhouette. Cards keep a thin (1px) border.

## Components

### Buttons

Primary forest actions use the action foreground. The discovery action has a minimum height (48px); the inspector review action uses (42px). Ghost controls use quiet text and a border, becoming mist-filled on hover. Primary hover applies brightness (1.08). Disabled buttons retain the implemented opacity (.42) and unavailable cursor. Keyboard focus uses a (2px) accent outline with (3px) offset.

### Chips

The amber review badge uses the status radius and compact padding. It labels the actual record state; it is not an action or a success badge.

### Cards / Containers

Image cards use the card radius and gallery padding. Hover changes the border to soft sage and the background to mist. Selection uses the accent border plus a (1px) outline. Keyboard focus retains the separate global outline.

Image frames use `object-fit: contain`, a desktop aspect ratio (1.45), and square mobile frames. Stored image URLs load lazily with `no-referrer`; a missing or failed image displays the implemented ImageOff message. The generated design mockup is not shipped product imagery. No new shipping rasters were introduced for C; provenance belongs to the source records.

### Inputs / Fields

Native inputs and selects share white/themed fill, a quiet border, and the control radius. Fields have minimum height (40px). Input focus shifts the border to accent and adds a soft (3px) halo; selects use the shared visible focus outline. No invented validation or connection state belongs in a visual example.

### Navigation

The rail stacks icons above labels. Selected navigation uses soft sage, forest text, and weight (650); hover uses the mist surface. Labels remain visible on mobile with smaller type and shorter rows. Header theme and shell controls remain standard buttons.

### Candidate Inspector

A white/themed card presents the selected candidate, numeric economics, amber hold reason, native estimate disclosure, and the full-record action. Missing economics stay visibly unresolved. Financial estimates are reference values; the registration/shipment lock copy remains visible.

### Disclosures

Native summary controls reveal settings, estimate evidence, or full records. Open setup uses the accent and weight (600); keyboard focus follows the global outline. The document does not define a new animation for disclosure expansion.

## Do's and Don'ts

### Do:

- Do retain the shared theme variables for new surfaces and controls.
- Do show stored image URLs with contain fitting and a visible missing-image fallback.
- Do retain visible focus and tabular figures for financial comparison.
- Do keep source-image provenance in candidate records and treat previews as internal review.

### Don't:

- Don't replace absent source images with invented products or the generated mockup.
- Don't use green to imply cleared profitability or permission to transact.
- Don't substitute zero for unknown costs or describe contribution estimates as confirmed net profit.
- Don't add a webfont dependency to reproduce the approved system stack.
