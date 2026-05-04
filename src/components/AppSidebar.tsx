/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */
/* eslint-disable react-refresh/only-export-components */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  mergeClasses,
  tokens,
  Button,
  Text,
  Spinner,
  MessageBar,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
} from '@fluentui/react-components';
import {
  DeleteRegular,
  SearchRegular,
  ComposeRegular,
  FolderRegular,
  DatabaseRegular,
  NumberSymbolRegular,
  SettingsRegular,
  WrenchRegular,
  ChevronRightRegular,
  ShieldCheckmarkRegular,
  DocumentSearchRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  PanelLeftContractRegular,
  PanelLeftExpandRegular,
  MoreHorizontalRegular,
  EditRegular,
  PinRegular,
  PinOffRegular,
} from '@fluentui/react-icons';
import type { SavedConversation } from '../types/conversation-types';
import {
  loadConversationsFromHistory,
  deleteConversationFromHistory,
  renameConversationInHistory,
  togglePinConversationInHistory,
} from '../utils/conversation-storage';
import { useConversationContext } from '../contexts/ConversationContext';
import { useStats } from '../hooks/use-ccf-data';
import { useConfig } from '../pages/ConfigPage';
import { useOpenAIKeyValidation } from '../hooks/use-openai-key-validation';
import { ConversationSearchDialog } from './ConversationSearchDialog';
import { isMstEnabled } from '../utils/feature-flags';
import ccfLogo from '../assets/ccf.svg';

export const APP_SIDEBAR_WIDTH = {
  expanded: 260,
  collapsed: 56,
} as const;

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    overflow: 'hidden',
  },
  expanded: {
    width: `${APP_SIDEBAR_WIDTH.expanded}px`,
  },
  collapsed: {
    width: `${APP_SIDEBAR_WIDTH.collapsed}px`,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    minHeight: '52px',
    boxSizing: 'border-box',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  brandRowCollapsed: {
    justifyContent: 'center',
    padding: '12px 8px',
  },
  brandLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    color: 'inherit',
    overflow: 'hidden',
  },
  brandTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: '8px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    padding: '6px 8px',
  },
  sectionDivider: {
    height: '1px',
    margin: '6px 12px',
    backgroundColor: tokens.colorNeutralStroke3,
  },
  sectionHeader: {
    padding: '10px 12px 4px',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'inherit',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
    // Normalize icon sizing so Fluent icons always render at 20px in the sidebar.
    '& > svg': {
      width: '20px',
      height: '20px',
      flexShrink: 0,
    },
  },
  rowActive: {
    backgroundColor: tokens.colorNeutralBackground3,
    fontWeight: tokens.fontWeightMedium,
  },
  rowCollapsed: {
    justifyContent: 'center',
    gap: 0,
    padding: '10px 0',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  convItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: '7px 10px',
    margin: '1px 0',
    borderRadius: '8px',
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  convItemActive: {
    backgroundColor: tokens.colorNeutralBackground3,
    fontWeight: tokens.fontWeightMedium,
  },
  convTitle: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    paddingRight: '24px',
    fontSize: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  pinIcon: {
    flexShrink: 0,
    width: '12px',
    height: '12px',
    color: tokens.colorNeutralForeground3,
  },
  kebabBtn: {
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0,
    transition: 'opacity 0.15s',
    minWidth: '22px',
    width: '22px',
    height: '22px',
  },
  kebabBtnVisible: {
    opacity: 1,
  },
  renameInput: {
    flex: 1,
    minWidth: 0,
    marginRight: '4px',
  },
  deleteBtn: {
    position: 'absolute',
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    opacity: 0,
    transition: 'opacity 0.15s',
    minWidth: '22px',
    width: '22px',
    height: '22px',
    '&:hover': {
      color: tokens.colorPaletteRedForeground2,
      backgroundColor: tokens.colorPaletteRedBackground2,
    },
  },
  empty: {
    padding: '16px 12px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  spinnerContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '12px',
  },
  errorBar: {
    margin: '8px',
  },
  footer: {
    padding: '8px',
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  footerCollapsed: {
    display: 'flex',
    justifyContent: 'center',
  },
  collapseBtn: {
    minWidth: '28px',
    width: '28px',
    height: '28px',
  },
});

interface AppSidebarProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ isDarkMode, onToggleTheme }) => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: stats } = useStats();
  const { config } = useConfig();
  const { data: keyValidation } = useOpenAIKeyValidation(config.openaiApiKey);
  const {
    activeConversationId,
    refreshSignal,
    selectConversation,
    startNewConversation,
  } = useConversationContext();

  // Match MenuBar's gating: chat UI shown only when active provider is
  // configured (SAGE build, OR a validated OpenAI key with chat enabled).
  const isSageBuild = import.meta.env.VITE_ENABLE_SAGE === 'true';
  const showChatTab = isSageBuild ||
    (config.chatEnabled && !!config.openaiApiKey && keyValidation?.valid === true);

  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const load = () => {
    try {
      setLoading(true);
      const loaded = loadConversationsFromHistory();
      setConversations(loaded);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [refreshSignal]);

  const hasData = !!stats && (stats.fileCount > 0 || stats.transactionCount > 0);

  const handleNewChat = () => {
    startNewConversation();
    if (location.pathname !== '/chat') navigate('/chat');
  };

  const handleSelectConv = (conv: SavedConversation) => {
    selectConversation(conv);
    if (location.pathname !== '/chat') navigate('/chat');
  };

  const handleDelete = (id: string) => {
    try {
      const remaining = deleteConversationFromHistory(id);
      setConversations(remaining);
      if (activeConversationId === id) startNewConversation();
    } catch {
      setError('Failed to delete');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const beginRename = (c: SavedConversation) => {
    setMenuOpenId(null);
    setRenameId(c.id);
    setRenameValue(c.title);
  };

  const commitRename = () => {
    if (!renameId) return;
    const original = conversations.find(c => c.id === renameId)?.title ?? '';
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== original) {
      try {
        const next = renameConversationInHistory(renameId, trimmed);
        setConversations(next);
      } catch {
        setError('Failed to rename');
      }
    }
    setRenameId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenameId(null);
    setRenameValue('');
  };

  const handleTogglePin = (id: string) => {
    setMenuOpenId(null);
    try {
      const next = togglePinConversationInHistory(id);
      setConversations(next);
    } catch {
      setError('Failed to pin');
    }
  };

  // Pinned first, then by whatever order they came in (newest-first from storage).
  const sortedConversations = React.useMemo(() => {
    const pinned = conversations.filter(c => c.pinned);
    const unpinned = conversations.filter(c => !c.pinned);
    return [...pinned, ...unpinned];
  }, [conversations]);
  const pendingDeleteConversation = pendingDeleteId
    ? conversations.find(c => c.id === pendingDeleteId)
    : undefined;

  const isRouteActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Build nav items dynamically.
  const navItems: Array<{
    path: string;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }> = [
    { path: '/files', label: 'Files', icon: <FolderRegular />, visible: true },
    { path: '/tables', label: 'Tables', icon: <DatabaseRegular />, visible: hasData },
    { path: '/stats', label: 'Stats', icon: <NumberSymbolRegular />, visible: hasData },
    { path: '/config', label: 'Configuration', icon: <SettingsRegular />, visible: true },
  ];

  const handleToolsMenuSelect = (toolValue: string) => {
    const map: Record<string, string> = {
      'ledger-verification': '/verification',
      'acl-receipt-verification': '/write-receipt',
      'cose-viewer': '/cose-viewer',
    };
    // MST Receipt Verification is preview-gated; only wire it up when on.
    if (isMstEnabled()) {
      map['mst-receipt-verification'] = '/mst-receipt';
    }
    const target = map[toolValue];
    if (target) navigate(target);
  };

  // Collapsed view: icons only.
  if (isCollapsed) {
    return (
      <div data-app-sidebar className={mergeClasses(styles.root, styles.collapsed)}>
        <div className={mergeClasses(styles.brandRow, styles.brandRowCollapsed)}>
          <Button
            appearance="subtle"
            icon={<PanelLeftExpandRegular />}
            onClick={() => setIsCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          />
        </div>
        <div className={styles.scrollArea}>
          <div className={styles.section}>
            {showChatTab && (
              <>
                <button
                  type="button"
                  className={mergeClasses(styles.row, styles.rowCollapsed)}
                  onClick={handleNewChat}
                  title="New chat"
                  aria-label="New chat"
                >
                  <ComposeRegular />
                </button>
                <button
                  type="button"
                  className={mergeClasses(styles.row, styles.rowCollapsed)}
                  onClick={() => setSearchOpen(true)}
                  title="Search chats"
                  aria-label="Search chats"
                >
                  <SearchRegular />
                </button>
              </>
            )}
            {navItems.filter(n => n.visible).map(n => (
              <button
                key={n.path}
                type="button"
                className={mergeClasses(styles.row, styles.rowCollapsed, isRouteActive(n.path) && styles.rowActive)}
                onClick={() => navigate(n.path)}
                title={n.label}
                aria-label={n.label}
              >
                {n.icon}
              </button>
            ))}
            <Menu positioning="after">
              <MenuTrigger disableButtonEnhancement>
                <button
                  type="button"
                  className={mergeClasses(styles.row, styles.rowCollapsed)}
                  title="Tools"
                  aria-label="Tools"
                >
                  <WrenchRegular />
                </button>
              </MenuTrigger>
              <ToolsMenuPopover hasData={hasData} onSelect={handleToolsMenuSelect} />
            </Menu>
          </div>
        </div>
        <div className={mergeClasses(styles.footer, styles.footerCollapsed)}>
          <Button
            appearance="subtle"
            icon={isDarkMode ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
            onClick={onToggleTheme}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          />
        </div>
        <ConversationSearchDialog
          open={searchOpen}
          conversations={conversations}
          onClose={() => setSearchOpen(false)}
          onSelect={handleSelectConv}
          onNewChat={handleNewChat}
        />
      </div>
    );
  }

  // Expanded view.
  return (
    <div data-app-sidebar className={mergeClasses(styles.root, styles.expanded)}>
      <div className={styles.brandRow}>
        <a className={styles.brandLeft} href="/" title="Ledger Explorer">
          <img height={26} src={ccfLogo} alt="Ledger Explorer Logo" />
          <span className={styles.brandTitle}>Ledger Explorer</span>
        </a>
        <Button
          appearance="subtle"
          icon={<PanelLeftContractRegular />}
          className={styles.collapseBtn}
          onClick={() => setIsCollapsed(true)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        />
      </div>

      {error && <MessageBar intent="error" className={styles.errorBar}>{error}</MessageBar>}

      <div className={styles.scrollArea}>
        {/* Chat actions */}
        {showChatTab && (
          <>
            <div className={styles.section}>
              <button type="button" className={styles.row} onClick={handleNewChat}>
                <ComposeRegular />
                <span className={styles.rowLabel}>New chat</span>
              </button>
              <button type="button" className={styles.row} onClick={() => setSearchOpen(true)}>
                <SearchRegular />
                <span className={styles.rowLabel}>Search chats</span>
              </button>
            </div>

            <div className={styles.sectionDivider} />
          </>
        )}

        {/* Navigation */}
        <div className={styles.section}>
          {navItems.filter(n => n.visible).map(n => (
            <button
              key={n.path}
              type="button"
              className={mergeClasses(styles.row, isRouteActive(n.path) && styles.rowActive)}
              onClick={() => navigate(n.path)}
            >
              {n.icon}
              <span className={styles.rowLabel}>{n.label}</span>
            </button>
          ))}
          <Menu positioning="after">
            <MenuTrigger disableButtonEnhancement>
              <button type="button" className={styles.row}>
                <WrenchRegular />
                <span className={styles.rowLabel}>Tools</span>
                <ChevronRightRegular />
              </button>
            </MenuTrigger>
            <ToolsMenuPopover hasData={hasData} onSelect={handleToolsMenuSelect} />
          </Menu>
        </div>

        {showChatTab && <div className={styles.sectionDivider} />}

        {/* Recents */}
        {showChatTab && <Text className={styles.sectionHeader} as="p">Recents</Text>}
        {showChatTab && <div className={styles.section} style={{ paddingTop: 0 }}>
          {loading ? (
            <div className={styles.spinnerContainer}><Spinner size="small" /></div>
          ) : conversations.length === 0 ? (
            <div className={styles.empty}>
              <Text size={200}>Your chats will appear here.</Text>
            </div>
          ) : (
            sortedConversations.map(c => {
              const isRenaming = renameId === c.id;
              const kebabVisible = hoveredId === c.id || menuOpenId === c.id;
              return (
                <div
                  key={c.id}
                  className={mergeClasses(styles.convItem, c.id === activeConversationId && styles.convItemActive)}
                  onClick={() => { if (!isRenaming) handleSelectConv(c); }}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(id => (id === c.id ? null : id))}
                  title={isRenaming ? undefined : c.title}
                >
                  {isRenaming ? (
                    <Input
                      size="small"
                      appearance="underline"
                      className={styles.renameInput}
                      value={renameValue}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(_, data) => setRenameValue(data.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                      }}
                    />
                  ) : (
                    <Text className={styles.convTitle}>
                      {c.pinned && <PinRegular className={styles.pinIcon} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </span>
                    </Text>
                  )}
                  {!isRenaming && (
                    <Menu
                      open={menuOpenId === c.id}
                      onOpenChange={(_, data) => setMenuOpenId(data.open ? c.id : (menuOpenId === c.id ? null : menuOpenId))}
                      positioning="after"
                    >
                      <MenuTrigger disableButtonEnhancement>
                        <Button
                          appearance="subtle"
                          icon={<MoreHorizontalRegular />}
                          className={mergeClasses(styles.kebabBtn, kebabVisible && styles.kebabBtnVisible)}
                          title="More"
                          aria-label={`More options for ${c.title}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          <MenuItem icon={<EditRegular />} onClick={() => beginRename(c)}>
                            Rename
                          </MenuItem>
                          <MenuItem
                            icon={c.pinned ? <PinOffRegular /> : <PinRegular />}
                            onClick={() => handleTogglePin(c.id)}
                          >
                            {c.pinned ? 'Unpin' : 'Pin'}
                          </MenuItem>
                          <MenuItem
                            icon={<DeleteRegular />}
                            onClick={() => { setMenuOpenId(null); setPendingDeleteId(c.id); }}
                          >
                            Delete
                          </MenuItem>
                        </MenuList>
                      </MenuPopover>
                    </Menu>
                  )}
                </div>
              );
            })
          )}
        </div>}
      </div>

      {/* Footer: theme toggle */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.row}
          onClick={onToggleTheme}
          aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
          <span className={styles.rowLabel}>
            {isDarkMode ? 'Light mode' : 'Dark mode'}
          </span>
        </button>
      </div>

      <ConversationSearchDialog
        open={searchOpen}
        conversations={conversations}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectConv}
        onNewChat={handleNewChat}
      />

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(_, data) => { if (!data.open) setPendingDeleteId(null); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogContent>
              This will permanently delete
              {pendingDeleteConversation ? ` "${pendingDeleteConversation.title}"` : ' this conversation'}.
              This action can't be undone.
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={() => { if (pendingDeleteId) handleDelete(pendingDeleteId); }}
              >
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

interface ToolsMenuPopoverProps {
  hasData: boolean;
  onSelect: (toolValue: string) => void;
}

/** The Tools dropdown contents, extracted so it can be reused for collapsed + expanded. */
const ToolsMenuPopover: React.FC<ToolsMenuPopoverProps> = ({ hasData, onSelect }) => {
  const mstEnabled = isMstEnabled();
  return (
    <MenuPopover>
      <MenuList>
        {hasData && (
          <MenuItem
            icon={<ShieldCheckmarkRegular />}
            onClick={() => onSelect('ledger-verification')}
          >
            Ledger Verification
          </MenuItem>
        )}
        <MenuItem
          icon={<DocumentSearchRegular />}
          onClick={() => onSelect('acl-receipt-verification')}
        >
          ACL Receipt Verification
        </MenuItem>
        {mstEnabled && (
          <MenuItem
            icon={<DocumentSearchRegular />}
            onClick={() => onSelect('mst-receipt-verification')}
          >
            MST Receipt Verification
          </MenuItem>
        )}
        <MenuItem
          icon={<DocumentSearchRegular />}
          onClick={() => onSelect('cose-viewer')}
        >
          COSE/CBOR Viewer
        </MenuItem>
      </MenuList>
    </MenuPopover>
  );
};
