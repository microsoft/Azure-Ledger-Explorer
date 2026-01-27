/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { makeStyles, tokens } from '@fluentui/react-components';

/**
 * Shared styles for chat components
 */
export const useChatStyles = makeStyles({
  // Layout containers
  container: {
    display: 'flex',
    minHeight: '100%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerWithMessages: {
    display: 'flex',
    minHeight: '100%',
    height: '100vh',
    overflowY: 'auto',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  sageTitle: {
    fontSize: '48px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    marginBottom: '32px',
    textAlign: 'center',
  },
  chatPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '830px',
    marginBottom: '220px',
  },
  messagesArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: '0',
  },

  // Message containers
  messageContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  userMessageContent: {
    maxWidth: '70%',
    minWidth: 0,
  },

  // Message bubbles
  messageBubble: {
    padding: '12px',
    borderRadius: '8px',
  },
  userBubble: {
    backgroundColor: tokens.colorNeutralBackground4,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground1,
  },
  messageText: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '16px',
  },

  // Markdown content
  markdownContent: {
    fontSize: '16px',
    lineHeight: '1.5',
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      marginTop: '16px',
      marginBottom: '8px',
      fontWeight: '600',
      color: tokens.colorNeutralForeground1,
    },
    '& h1': { fontSize: '20px' },
    '& h2': { fontSize: '18px' },
    '& h3': { fontSize: '16px' },
    '& p': {
      margin: '8px 0',
      lineHeight: '1.5',
    },
    '& ul, & ol': {
      margin: '8px 0',
      paddingLeft: '24px',
    },
    '& li': {
      margin: '4px 0',
    },
    '& blockquote': {
      margin: '12px 0',
      padding: '8px 16px',
      borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
      backgroundColor: tokens.colorNeutralBackground2,
      fontStyle: 'italic',
    },
    '& code': {
      backgroundColor: tokens.colorNeutralBackground3,
      padding: '2px 4px',
      borderRadius: '4px',
      fontSize: '14px',
      fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
    },
    '& pre': {
      margin: '12px 0',
      padding: '12px',
      backgroundColor: tokens.colorNeutralBackground6,
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '14px',
      lineHeight: '1.4',
    },
    '& pre code': {
      backgroundColor: 'transparent',
      padding: '0',
    },
    '& a': {
      color: tokens.colorBrandForeground1,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      margin: '12px 0',
    },
    '& th, & td': {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: '8px 12px',
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: tokens.colorNeutralBackground2,
      fontWeight: '600',
    },
  },

  // Annotations
  annotationsSection: {
    margin: '12px 0 0 0',
  },
  annotationsHeader: {
    fontSize: '16px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground3,
  },
  annotationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '0',
  },
  annotationItem: {
    fontSize: '14px',
    color: tokens.colorNeutralForeground3,
    listStyleType: 'none',
  },
  annotationLink: {
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },

  // Actions/SQL section
  actionSection: {
    margin: '12px 0 0 0',
  },
  actionHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: tokens.colorBrandForeground1,
  },
  actionQuery: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '8px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    margin: '4px 0',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace',
  },
  cleanedResult: {
    margin: '8px 0',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: '8px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  rawDataDetails: {
    margin: '8px 0',
    '& summary': {
      cursor: 'pointer',
      fontSize: '12px',
      color: tokens.colorNeutralForeground3,
      padding: '4px 0',
      '&:hover': {
        color: tokens.colorNeutralForeground2,
      },
    },
    '& summary::-webkit-details-marker': {
      display: 'none',
    },
    '& summary::before': {
      content: '"▶ "',
      fontSize: '10px',
    },
    '&[open] summary::before': {
      content: '"▼ "',
    },
  },

  // Error section
  errorSection: {
    margin: '8px 0 0 0',
  },

  // Loading
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: tokens.colorNeutralForeground3,
  },

  // Input area
  inputArea: {
    position: 'fixed',
    bottom: '20px',
    maxWidth: '830px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 16px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `0px solid ${tokens.colorNeutralStroke2}`,
  },
  inputAreaAnimating: {
    transition: 'left 0.25s ease, width 0.25s ease',
  },
  inputAreaCentered: {},
  errorContainer: {
    padding: '8px 16px 0 16px',
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
  },
  chatInputContainer: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 10px 5px 10px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: '28px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    '&:focus-within': {
      border: `1px solid ${tokens.colorBrandStroke1}`,
    },
  },
  inputTextareaContainer: {
    width: '100%',
    padding: '8px 20px 8px 8px',
    minHeight: '24px',
  },
  inputTextarea: {
    flex: 1,
    width: '100%',
    minHeight: '24px',
    maxHeight: '72px',
    border: 'none',
    backgroundColor: 'transparent',
    resize: 'none',
    fontSize: '16px',
    lineHeight: '24px',
    padding: '0',
    fontFamily: 'inherit',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    overflowY: 'auto',
    color: tokens.colorNeutralForeground1,
    '&:focus': {
      outline: 'none',
    },
    '&::placeholder': {
      color: tokens.colorNeutralForeground3,
    },
  },
  buttonsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '0px',
  },
  sendButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
    border: 'none',
    color: tokens.colorNeutralForegroundInverted,
    '&:disabled': {
      backgroundColor: tokens.colorNeutralBackground4,
      color: tokens.colorNeutralForeground4,
    },
    '&:hover:not(:disabled)': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
  },
  stopButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: tokens.colorPaletteBlueBorderActive,
    border: 'none',
    color: tokens.colorNeutralForegroundInverted,
  },
  newConversationButton: {
    minWidth: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground1,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
      border: `1px solid ${tokens.colorNeutralStroke1Hover}`,
    },
  },

  // Starter templates
  starterTemplates: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: '12px',
    width: '100%',
    maxWidth: '830px',
    justifyContent: 'center',
  },
});
