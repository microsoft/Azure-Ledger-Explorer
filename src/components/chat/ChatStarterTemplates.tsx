/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import { CompoundButton } from '@fluentui/react-components';
import { ChatAddRegular } from '@fluentui/react-icons';
import { useChatStyles } from './chat.styles';

export interface StarterTemplate {
  show: boolean;
  group: string;
  text: string;
}

interface ChatStarterTemplatesProps {
  /** Templates to display */
  templates: StarterTemplate[];
  /** Callback when a template is selected */
  onSelect: (text: string) => void;
}

/**
 * Starter template buttons shown when chat is empty
 */
export const ChatStarterTemplates: React.FC<ChatStarterTemplatesProps> = ({
  templates,
  onSelect,
}) => {
  const styles = useChatStyles();

  return (
    <div className={styles.starterTemplates}>
      {templates.map((template, index) => 
        template.show && (
          <CompoundButton
            key={index}
            icon={<ChatAddRegular />}
            secondaryContent={template.text}
            appearance="transparent"
            onClick={() => onSelect(template.text)}
          >
            {template.group}
          </CompoundButton>
        )
      )}
    </div>
  );
};
