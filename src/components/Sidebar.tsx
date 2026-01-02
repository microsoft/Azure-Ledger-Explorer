/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { makeStyles, tokens, Button, Text } from '@fluentui/react-components';
import { ChevronLeftRegular, ChevronRightRegular } from '@fluentui/react-icons';
import { SIDEBAR_WIDTH } from './sidebar-constants';

const MIN_WIDTH = 180;
const MAX_WIDTH = 600;

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
    position: 'relative',
  },
  collapsed: {
    width: `${SIDEBAR_WIDTH.collapsed}px`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    minHeight: '48px',
    boxSizing: 'border-box',
  },
  headerCollapsed: {
    justifyContent: 'center',
    padding: '12px 8px',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  collapseButton: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  contentPadded: {
    padding: '8px',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: '8px',
    flexShrink: 0,
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '6px',
    height: '100%',
    cursor: 'col-resize',
    backgroundColor: 'transparent',
    zIndex: 10,
    transition: 'background-color 0.15s ease',
    '&:hover': {
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  resizeHandleActive: {
    backgroundColor: tokens.colorBrandBackground,
  },
});

export interface SidebarProps {
  /** The title displayed in the sidebar header */
  title: string;
  /** Optional icon to display before the title */
  icon?: React.ReactNode;
  /** Whether the sidebar is currently collapsed */
  isCollapsed?: boolean;
  /** Callback when the collapse toggle is clicked */
  onToggleCollapse?: () => void;
  /** Whether to show the collapse toggle button */
  collapsible?: boolean;
  /** Main content to render in the sidebar */
  children: React.ReactNode;
  /** Optional actions to show in the header (e.g., buttons) */
  headerActions?: React.ReactNode;
  /** Whether to add default padding to the content area */
  contentPadded?: boolean;
  /** Additional class name for the root element */
  className?: string;
  /** Whether the sidebar can be resized by dragging */
  resizable?: boolean;
  /** Initial width of the sidebar (defaults to SIDEBAR_WIDTH.expanded) */
  initialWidth?: number;
  /** Callback when the width changes during resize */
  onWidthChange?: (width: number) => void;
}

/**
 * A unified sidebar component for consistent navigation/content panels across the app.
 * Supports collapsible behavior with smooth animations and consistent styling.
 * 
 * Can be used in controlled mode (providing isCollapsed/onToggleCollapse) or 
 * uncontrolled mode (just set collapsible=true and it manages its own state).
 * 
 * @example
 * ```tsx
 * // Uncontrolled mode - sidebar manages its own collapsed state
 * <Sidebar title="Tables" icon={<DatabaseRegular />} collapsible>
 *   <TablesList tables={tables} />
 * </Sidebar>
 * 
 * // Controlled mode - parent manages collapsed state
 * <Sidebar
 *   title="Tables"
 *   icon={<DatabaseRegular />}
 *   isCollapsed={isCollapsed}
 *   onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
 *   collapsible
 * >
 *   <TablesList tables={tables} />
 * </Sidebar>
 * ```
 */
export const Sidebar: React.FC<SidebarProps> = ({
  title,
  icon,
  isCollapsed: isCollapsedProp,
  onToggleCollapse,
  collapsible = true,
  children,
  headerActions,
  contentPadded = true,
  className,
  resizable = false,
  initialWidth = SIDEBAR_WIDTH.expanded,
  onWidthChange,
}) => {
  const styles = useStyles();
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Internal collapsed state for uncontrolled mode
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  
  // Determine if we're in controlled or uncontrolled mode
  const isControlled = isCollapsedProp !== undefined;
  const isCollapsed = isControlled ? isCollapsedProp : internalCollapsed;
  
  // Toggle handler that works for both modes
  const handleToggleCollapse = useCallback(() => {
    if (isControlled && onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(prev => !prev);
    }
  }, [isControlled, onToggleCollapse]);

  // Handle mouse move during resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!sidebarRef.current) return;
    
    const sidebarRect = sidebarRef.current.getBoundingClientRect();
    const newWidth = e.clientX - sidebarRect.left;
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
    
    setWidth(clampedWidth);
    onWidthChange?.(clampedWidth);
  }, [onWidthChange]);

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Attach/detach global mouse events for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Start resizing
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const rootClassName = [
    styles.root,
    isCollapsed ? styles.collapsed : '',
    className,
  ].filter(Boolean).join(' ');

  const headerClassName = [
    styles.header,
    isCollapsed ? styles.headerCollapsed : '',
  ].filter(Boolean).join(' ');

  const contentClassName = [
    styles.content,
    contentPadded ? styles.contentPadded : '',
  ].filter(Boolean).join(' ');

  // Collapsed view: just show expand button
  if (isCollapsed) {
    return (
      <div className={rootClassName}>
        <div className={headerClassName}>
          {collapsible && (
            <Button
              appearance="subtle"
              icon={<ChevronRightRegular />}
              onClick={handleToggleCollapse}
              title={`Expand ${title}`}
              aria-label={`Expand ${title}`}
              className={styles.collapseButton}
            />
          )}
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div 
      ref={sidebarRef}
      className={rootClassName}
      style={{ width: `${width}px` }}
    >
      <div className={headerClassName}>
        <div className={styles.headerContent}>
          {icon}
          <Text className={styles.title}>{title}</Text>
        </div>
        {headerActions && (
          <div className={styles.headerActions}>
            {headerActions}
          </div>
        )}
        {collapsible && (
          <Button
            appearance="subtle"
            icon={<ChevronLeftRegular />}
            onClick={handleToggleCollapse}
            title={`Collapse ${title}`}
            aria-label={`Collapse ${title}`}
            className={styles.collapseButton}
          />
        )}
      </div>
      <div className={contentClassName}>
        {children}
      </div>
      {resizable && (
        <div
          className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      )}
    </div>
  );
};
