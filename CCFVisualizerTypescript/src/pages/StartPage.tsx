import React from 'react';
import { 
  Text, 
  Card, 
  CardFooter, 
  Button, 
  makeStyles, 
  tokens,
} from '@fluentui/react-components';
import { 
  Bot24Filled, 
  DocumentFolder24Filled,
  ChevronRight24Regular 
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  content: {
    flex: 1,
    overflowX: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '32px',
    paddingLeft: '32px',
    paddingRight: '32px',
  },
  cardsContainer: {
    display: 'flex',
    gap: '24px',
    width: '100%',
    maxWidth: '800px',
  },
  card: {
    flex: 1,
    cursor: 'pointer',
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: tokens.shadow16,
    },
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '32px',
    gap: '16px',
    textAlign: 'center',
  },
  cardIcon: {
    fontSize: '48px',
    color: tokens.colorBrandForeground1,
  },
  cardTitle: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
  },
  cardDescription: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'center',
    padding: '16px 32px',
  },
});

export const StartPage: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();

  const handleAutomatedClick = () => {
    navigate('/chat');
  };

  const handleManualClick = () => {
    navigate('/files');
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.cardsContainer}>

          {/* Automated Way Card */}
          { import.meta.env.VITE_DISABLE_SAGE !== 'true' && <Card className={styles.card} onClick={handleAutomatedClick}>
            <div className={styles.cardContent}>
              <Bot24Filled className={styles.cardIcon} />
              <Text className={styles.cardTitle}>Automated Analysis</Text>
              <Text className={styles.cardDescription}>
                Let agent guide you through your analysis. Ask questions in natural language and get instant insights.
              </Text>
            </div>
            <CardFooter className={styles.cardFooter}>
              <Button appearance="primary" icon={<ChevronRight24Regular />} iconPosition="after">
                Start Chat
              </Button>
            </CardFooter>
          </Card> }

          {/* Manual Way Card */}
          <Card className={styles.card} onClick={handleManualClick}>
            <div className={styles.cardContent}>
              <DocumentFolder24Filled className={styles.cardIcon} />
              <Text className={styles.cardTitle}>Forensic Exploration</Text>
              <Text className={styles.cardDescription}>
                Import, browse and explore the ledger data manually. Upload files, view transactions, and analyze data at your own pace.
              </Text>
            </div>
            <CardFooter className={styles.cardFooter}>
              <Button appearance="outline" icon={<ChevronRight24Regular />} iconPosition="after">
                Browse Files
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};
