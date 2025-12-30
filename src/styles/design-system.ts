/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * CCF Ledger Explorer Design System
 * Built on Fluent UI.
 */

import { tokens, makeStyles, shorthands } from '@fluentui/react-components';

// ============================================================================
// DESIGN TOKENS - Custom extensions to Fluent UI
// ============================================================================

export const designTokens = {
  // Accent colors - a teal/cyan for "verified/trusted" feel
  accentPrimary: tokens.colorBrandBackground,
  accentSuccess: tokens.colorPaletteGreenBackground3,
  accentDanger: tokens.colorPaletteRedBackground3,
  accentWarning: tokens.colorPaletteYellowBackground3,
  
  // Typography - Cascadia Code is Microsoft's official monospace
  fontMono: `"Cascadia Code", "Consolas", "Fira Code", ${tokens.fontFamilyMonospace}`,
  fontDisplay: tokens.fontFamilyBase, // Segoe UI
  
  // Spacing rhythm (4px base grid, Fluent standard)
  space1: '4px',
  space2: '8px',
  space3: '12px',
  space4: '16px',
  space5: '20px',
  space6: '24px',
  space7: '32px',
  space8: '48px',
  
  // Border radii
  radiusSmall: tokens.borderRadiusSmall,
  radiusMedium: tokens.borderRadiusMedium,
  radiusLarge: tokens.borderRadiusLarge,
  radiusXLarge: tokens.borderRadiusXLarge,
  
  // Shadows
  shadowSubtle: tokens.shadow2,
  shadowMedium: tokens.shadow8,
  shadowElevated: tokens.shadow16,
  shadowDramatic: tokens.shadow64,
  
  // Fluent motion curves
  transitionFast: '100ms cubic-bezier(0.33, 0, 0.67, 1)',
  transitionNormal: '150ms cubic-bezier(0.33, 0, 0.67, 1)',
  transitionSlow: '250ms cubic-bezier(0.33, 0, 0.67, 1)',
  transitionDecelerate: '200ms cubic-bezier(0, 0, 0, 1)',
} as const;

// ============================================================================
// SHARED STYLE UTILITIES
// ============================================================================

/**
 * Common animation keyframes as CSS strings for use in makeStyles
 */
export const animations = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  slideUp: `
    @keyframes slideUp {
      from { 
        opacity: 0; 
        transform: translateY(8px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `,
  shimmer: `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `,
};

/**
 * Shared styles for common patterns - use with mergeClasses
 */
export const useSharedStyles = makeStyles({
  // -------------------------------------------------------------------------
  // LAYOUT PRIMITIVES
  // -------------------------------------------------------------------------
  
  /** Full-height flex container */
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  
  /** Scrollable content area */
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  
  /** Centered content wrapper */
  contentWrapper: {
    maxWidth: '1400px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: designTokens.space5,
    paddingRight: designTokens.space5,
    width: '100%',
    boxSizing: 'border-box',
  },
  
  /** Grid for cards/stats */
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: designTokens.space4,
  },
  
  // -------------------------------------------------------------------------
  // PAGE HEADERS
  // -------------------------------------------------------------------------
  
  /** Unified page header */
  pageHeader: {
    paddingTop: designTokens.space5,
    paddingBottom: designTokens.space5,
    paddingLeft: designTokens.space6,
    paddingRight: designTokens.space6,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  
  /** Page title typography - Fluent Title 3 (24/32) */
  pageTitle: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: designTokens.space1,
  },
  
  /** Page subtitle/description - Fluent Body 1 (14/20) */
  pageSubtitle: {
    fontSize: '14px',
    lineHeight: '20px',
    color: tokens.colorNeutralForeground2,
  },
  
  // -------------------------------------------------------------------------
  // CARDS & SURFACES
  // -------------------------------------------------------------------------
  
  /** Interactive card with hover state */
  interactiveCard: {
    cursor: 'pointer',
    transitionProperty: 'transform, box-shadow',
    transitionDuration: designTokens.transitionNormal,
    transitionTimingFunction: 'ease',
    ':hover': {
      transform: 'translateY(-2px)',
      boxShadow: tokens.shadow8,
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
  
  /** Subtle surface with border */
  surface: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  
  /** Elevated surface */
  surfaceElevated: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow4,
  },
  
  // -------------------------------------------------------------------------
  // DATA DISPLAY
  // -------------------------------------------------------------------------
  
  /** Monospace text for data/hashes - Caption 1 size */
  monoText: {
    fontFamily: designTokens.fontMono,
    fontSize: '12px',
    lineHeight: '16px',
  },
  
  /** Large monospace for sequence numbers, IDs - Body 1 size */
  monoLarge: {
    fontFamily: designTokens.fontMono,
    fontSize: '14px',
    lineHeight: '20px',
    fontWeight: tokens.fontWeightMedium,
  },
  
  /** Sequence/ID badge style */
  sequenceBadge: {
    fontFamily: designTokens.fontMono,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightMedium,
    paddingLeft: designTokens.space2,
    paddingRight: designTokens.space2,
    paddingTop: designTokens.space1,
    paddingBottom: designTokens.space1,
    backgroundColor: tokens.colorNeutralBackground4,
    ...shorthands.borderRadius(tokens.borderRadiusSmall),
  },
  
  /** Truncated text with ellipsis */
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  
  // -------------------------------------------------------------------------
  // STATUS INDICATORS
  // -------------------------------------------------------------------------
  
  /** Success state */
  statusSuccess: {
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  
  /** Warning state */
  statusWarning: {
    color: tokens.colorPaletteYellowForeground1,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  
  /** Error state */
  statusError: {
    color: tokens.colorPaletteRedForeground1,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  
  /** Info/neutral state */
  statusInfo: {
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  
  // -------------------------------------------------------------------------
  // INTERACTIVE STATES
  // -------------------------------------------------------------------------
  
  /** Keyboard focus ring */
  focusRing: {
    ':focus-visible': {
      outlineWidth: '2px',
      outlineStyle: 'solid',
      outlineColor: tokens.colorBrandStroke1,
      outlineOffset: '2px',
    },
  },
  
  /** Subtle hover highlight */
  hoverHighlight: {
    transitionProperty: 'background-color',
    transitionDuration: designTokens.transitionFast,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  
  // -------------------------------------------------------------------------
  // ANIMATIONS
  // -------------------------------------------------------------------------
  
  /** Fade in on mount */
  animateFadeIn: {
    animationName: 'fadeIn',
    animationDuration: '200ms',
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
  },
  
  /** Slide up on mount */
  animateSlideUp: {
    animationName: 'slideUp',
    animationDuration: '300ms',
    animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    animationFillMode: 'both',
  },
  
  /** Loading shimmer effect */
  shimmer: {
    backgroundImage: `linear-gradient(
      90deg,
      ${tokens.colorNeutralBackground3} 0%,
      ${tokens.colorNeutralBackground1} 50%,
      ${tokens.colorNeutralBackground3} 100%
    )`,
    backgroundSize: '200% 100%',
    animationName: 'shimmer',
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  
  // -------------------------------------------------------------------------
  // EMPTY STATES
  // -------------------------------------------------------------------------
  
  /** Centered empty state container */
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: designTokens.space7,
    paddingBottom: designTokens.space7,
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  
  /** Empty state icon */
  emptyStateIcon: {
    fontSize: '48px',
    marginBottom: designTokens.space4,
    color: tokens.colorNeutralForeground4,
  },
  
  // -------------------------------------------------------------------------
  // SIDEBARS & PANELS
  // -------------------------------------------------------------------------
  
  /** Sidebar container */
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
  },
  
  /** Sidebar header */
  sidebarHeader: {
    paddingTop: designTokens.space4,
    paddingBottom: designTokens.space4,
    paddingLeft: designTokens.space4,
    paddingRight: designTokens.space4,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  
  /** Sidebar content */
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    padding: designTokens.space2,
  },
  
  // -------------------------------------------------------------------------
  // TABLE ENHANCEMENTS
  // -------------------------------------------------------------------------
  
  /** Data table container */
  tableContainer: {
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  
  /** Table row hover */
  tableRowHover: {
    transitionProperty: 'background-color',
    transitionDuration: designTokens.transitionFast,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  
  /** Clickable table row */
  tableRowClickable: {
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: designTokens.transitionFast,
    ':hover': {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
    ':active': {
      backgroundColor: tokens.colorSubtleBackgroundPressed,
    },
  },
});

// ============================================================================
// CSS CUSTOM PROPERTIES (inject into :root via index.html or App.tsx)
// ============================================================================

export const cssCustomProperties = `
  :root {
    /* Animation keyframes */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { 
        opacity: 0; 
        transform: translateY(8px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    
    /* Stagger animation delays */
    --stagger-1: 0ms;
    --stagger-2: 50ms;
    --stagger-3: 100ms;
    --stagger-4: 150ms;
    --stagger-5: 200ms;
  }
`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate staggered animation delay style
 */
export function staggerDelay(index: number, baseDelay = 0, increment = 50): React.CSSProperties {
  return {
    animationDelay: `${baseDelay + (index * increment)}ms`,
  };
}

/**
 * Format large numbers with locale-aware separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
