/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { Text } from '@fluentui/react-components';
import type { ChatAnnotation } from '../../types/chat-types';
import { useChatStyles } from './chat.styles';

interface ChatAnnotationsProps {
  /** Annotations to display */
  annotations: Record<string, ChatAnnotation>;
  /** Function to get URL for an annotation file */
  getAnnotationUrl: (fileId: string) => string | null;
}

/**
 * Displays references/annotations for a message
 */
export const ChatAnnotations: React.FC<ChatAnnotationsProps> = ({
  annotations,
  getAnnotationUrl,
}) => {
  const styles = useChatStyles();

  if (!annotations || Object.keys(annotations).length === 0) {
    return null;
  }

  return (
    <div className={styles.annotationsSection}>
      <Text className={styles.annotationsHeader}>References:</Text>
      <ul className={styles.annotationsList}>
        {Object.values(annotations).map((annotation) => {
          const refsText = annotation.refs && annotation.refs.length > 0 
            ? annotation.refs.map(r => `[${r}]`).join(', ') + ' ' 
            : '';
          const annotationUrl = annotation.file_id 
            ? getAnnotationUrl(annotation.file_id) 
            : null;
          const displayName = annotation.filename || annotation.file_id || 'Referenced file';

          return (
            <li key={annotation.file_id} className={styles.annotationItem}>
              {annotationUrl ? (
                <a 
                  href={annotationUrl} 
                  className={styles.annotationLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  {refsText}{displayName}
                </a>
              ) : (
                <>{refsText}{displayName}</>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
