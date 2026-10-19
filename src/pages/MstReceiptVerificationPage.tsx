/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React from 'react';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Button,
  Field,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Badge,
  Divider,
  Link,
} from '@fluentui/react-components';
import {
  ShieldCheckmark24Regular,
  Checkmark16Filled,
  Dismiss16Filled,
  QuestionCircle16Regular,
} from '@fluentui/react-icons';
import { useScittVerification } from '../hooks/use-scitt-verification';
import type { ChainValidation, ReceiptFacts, ScittOutcome, TriState } from '../types/scitt-types';

const useStyles = makeStyles({
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' },
  content: {
    padding: tokens.spacingVerticalXXL,
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM },
  icon: { fontSize: '32px', color: tokens.colorBrandForeground1 },
  title: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightHero700,
  },
  description: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase400 },
  card: { marginBottom: tokens.spacingVerticalXL },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXL,
  },
  inputRow: { display: 'flex', gap: tokens.spacingHorizontalL, flexWrap: 'wrap' },
  inputCol: { display: 'flex', flexDirection: 'column', minWidth: '280px', flex: 1 },
  actions: { display: 'flex', gap: tokens.spacingHorizontalM, alignItems: 'center' },
  checkList: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  checkRow: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  pass: { color: tokens.colorPaletteGreenForeground1 },
  fail: { color: tokens.colorPaletteRedForeground1 },
  skip: { color: tokens.colorNeutralForeground3 },
  mono: {
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: tokens.fontSizeBase200,
    wordBreak: 'break-all',
    color: tokens.colorNeutralForeground2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: tokens.spacingVerticalM,
  },
  sectionTitle: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
});

/**
 * Renders a tri-state check.
 *
 * `null` gets its own icon rather than sharing one with `false`. A check that
 * did not run has established nothing, and showing it as a failure would
 * report a stale key set as a bad signature.
 */
const CheckRow: React.FC<{ label: string; state: TriState; skipReason?: string }> = ({
  label,
  state,
  skipReason = 'did not run',
}) => {
  const styles = useStyles();
  const { icon, className, suffix } =
    state === true
      ? { icon: <Checkmark16Filled />, className: styles.pass, suffix: '' }
      : state === false
        ? { icon: <Dismiss16Filled />, className: styles.fail, suffix: '' }
        : {
            icon: <QuestionCircle16Regular />,
            className: styles.skip,
            suffix: ` — ${skipReason}`,
          };

  return (
    <div className={`${styles.checkRow} ${className}`}>
      {icon}
      <Text size={300}>
        {label}
        {suffix}
      </Text>
    </div>
  );
};

/**
 * Splits chain validation into the two questions a user actually has: does the
 * chain hold together, and does it lead somewhere they trust. Without trusted
 * roots the second never ran, and must say so rather than read as a failure.
 */
const chainChecks = (
  chain: ChainValidation,
  anchoringRequested: boolean,
): { holds: TriState; holdsReason?: string; anchored: TriState; anchoredReason?: string } => {
  if (chain.status === 'notEvaluated') {
    return { holds: null, anchored: null };
  }
  if (chain.outcome === 'valid') {
    return {
      holds: true,
      anchored: chain.anchoredExternally ? true : null,
      anchoredReason: 'no trusted roots supplied',
    };
  }
  if (chain.outcome === 'invalid') {
    return { holds: false, anchored: anchoringRequested ? false : null, anchoredReason: 'no trusted roots supplied' };
  }
  return {
    holds: null,
    holdsReason: chain.reason,
    anchored: null,
    anchoredReason: anchoringRequested ? chain.reason : 'no trusted roots supplied',
  };
};

const OUTCOME_INTENT: Record<ScittOutcome, 'success' | 'error' | 'warning'> = {
  transparent: 'success',
  'not-transparent': 'error',
  'cannot-evaluate': 'warning',
  unsigned: 'warning',
};

const OUTCOME_TITLE: Record<ScittOutcome, string> = {
  transparent: 'Transparent',
  'not-transparent': 'Not transparent',
  'cannot-evaluate': 'Cannot evaluate',
  unsigned: 'Signature not checkable',
};

const ReceiptCard: React.FC<{ receipt: ReceiptFacts; index: number }> = ({ receipt, index }) => {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <div className={styles.cardContent}>
        <div className={styles.headerRow}>
          <Text className={styles.sectionTitle}>Receipt {index + 1}</Text>
          <Badge appearance="tint" color={receipt.fullyVerified ? 'success' : 'warning'}>
            {receipt.fullyVerified ? 'Verified' : 'Not verified'}
          </Badge>
          {receipt.algorithm && (
            <Badge appearance="outline" color="informative">
              {receipt.algorithm.name}
            </Badge>
          )}
        </div>

        <div className={styles.checkList}>
          <CheckRow label="Root signature verified" state={receipt.rootSignatureValid} />
          <CheckRow label="Receipt commits to this statement" state={receipt.boundToStatement} />
          <CheckRow label="Key id is bound to the key material" state={receipt.kidBoundToKey} />
        </div>

        <div className={styles.grid}>
          <div>
            <Text weight="semibold" block size={300}>
              Issuer
            </Text>
            <Text className={styles.mono}>{receipt.issuer ?? '—'}</Text>
          </div>
          <div>
            <Text weight="semibold" block size={300}>
              Key lookup
            </Text>
            <Text className={styles.mono}>{receipt.keyLookup ?? '—'}</Text>
          </div>
          <div>
            <Text weight="semibold" block size={300}>
              Merkle root
            </Text>
            <Text className={styles.mono}>{receipt.root ?? '—'}</Text>
          </div>
          <div>
            <Text weight="semibold" block size={300}>
              Inclusion path length
            </Text>
            <Text className={styles.mono}>{receipt.pathLength ?? '—'}</Text>
          </div>
          <div>
            <Text weight="semibold" block size={300}>
              Registered at
            </Text>
            <Text className={styles.mono}>
              {receipt.registeredAt ? new Date(receipt.registeredAt * 1000).toISOString() : '—'}
            </Text>
          </div>
          <div>
            <Text weight="semibold" block size={300}>
              Key id
            </Text>
            <Text className={styles.mono}>{receipt.kid ?? '—'}</Text>
          </div>
        </div>

        {receipt.problems.length > 0 && (
          <MessageBar intent="warning">
            <MessageBarBody>
              {receipt.problems.map((problem) => (
                <Text key={problem} block size={300}>
                  {problem}
                </Text>
              ))}
            </MessageBarBody>
          </MessageBar>
        )}
      </div>
    </Card>
  );
};

export const MstReceiptVerificationPage: React.FC = () => {
  const styles = useStyles();
  const verification = useScittVerification();

  const [statement, setStatement] = React.useState<File | null>(null);
  const [keySet, setKeySet] = React.useState<File | null>(null);
  const [trustedRoots, setTrustedRoots] = React.useState<File | null>(null);

  const { mutate } = verification;

  const onVerify = React.useCallback(async () => {
    if (!statement || !keySet) return;
    const [statementBytes, keySetBytes, rootsPem] = await Promise.all([
      statement.arrayBuffer(),
      keySet.arrayBuffer(),
      trustedRoots?.text(),
    ]);
    mutate({
      statement: statementBytes,
      keySet: keySetBytes,
      trustedRoots: rootsPem,
    });
  }, [statement, keySet, trustedRoots, mutate]);

  const result = verification.data;
  const chain = result
    ? chainChecks(result.facts.chainValidation, verification.variables?.trustedRoots !== undefined)
    : null;
  const chainReason =
    result?.facts.chainValidation.status === 'evaluated' && result.facts.chainValidation.outcome === 'invalid'
      ? result.facts.chainValidation.reason
      : null;

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerRow}>
            <ShieldCheckmark24Regular className={styles.icon} />
            <Text className={styles.title}>Signing Transparency Receipt Verification</Text>
            <Badge appearance="tint" color="informative">
              Preview
            </Badge>
          </div>
          <Text className={styles.description}>
            Verify SCITT transparent statements from Microsoft Signing Transparency entirely in your
            browser. Verification runs in a WebAssembly build of{' '}
            <Link
              href="https://github.com/microsoft/scitt-verifier"
              target="_blank"
              rel="noopener noreferrer"
            >
              microsoft/scitt-verifier
            </Link>
            , the same core the offline CLI uses. Nothing you select leaves this machine.
          </Text>
        </div>

        <Card className={styles.card}>
          <div className={styles.cardContent}>
            <div className={styles.inputRow}>
              <div className={styles.inputCol}>
                <Field label="Transparent statement (.cose)">
                  <input
                    type="file"
                    accept=".cose,.bin"
                    onChange={(e) => setStatement(e.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
              <div className={styles.inputCol}>
                <Field label="Transparency service keys (COSE_KeySet, .cbor)">
                  <input
                    type="file"
                    accept=".cbor,.bin"
                    onChange={(e) => setKeySet(e.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
              <div className={styles.inputCol}>
                <Field
                  label="Trusted roots (optional, PEM)"
                  hint="CA certificates that should anchor the signer's chain. Without them the chain is checked only against the root the statement carries, which anyone can mint."
                >
                  <input
                    type="file"
                    accept=".pem,.crt,.cer"
                    onChange={(e) => setTrustedRoots(e.target.files?.[0] ?? null)}
                  />
                </Field>
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                appearance="primary"
                disabled={!statement || !keySet || verification.isPending}
                onClick={onVerify}
              >
                Verify
              </Button>
              {verification.isPending && <Spinner size="tiny" label="Verifying…" />}
            </div>
          </div>
        </Card>

        {verification.isError && (
          <MessageBar intent="error" className={styles.card}>
            <MessageBarBody>
              <MessageBarTitle>Could not evaluate these bytes</MessageBarTitle>
              {verification.error.message}
            </MessageBarBody>
          </MessageBar>
        )}

        {result && (
          <>
            <MessageBar intent={OUTCOME_INTENT[result.outcome]} className={styles.card}>
              <MessageBarBody>
                <MessageBarTitle>{OUTCOME_TITLE[result.outcome]}</MessageBarTitle>
                {result.summary}
              </MessageBarBody>
            </MessageBar>

            <Card className={styles.card}>
              <div className={styles.cardContent}>
                <Text className={styles.sectionTitle}>Statement</Text>
                <div className={styles.checkList}>
                  <CheckRow
                    label="Issuer's signature over the statement"
                    state={result.facts.signatureValid}
                  />
                  {chain && (
                    <>
                      <CheckRow
                        label="Signer's certificate chain validates"
                        state={chain.holds}
                        skipReason={chain.holdsReason}
                      />
                      <CheckRow
                        label="Signer's chain is anchored to a trusted root"
                        state={chain.anchored}
                        skipReason={chain.anchoredReason}
                      />
                    </>
                  )}
                  <CheckRow
                    label="Certificates valid at registration time"
                    state={result.facts.certificatesValidAtRegistration}
                  />
                </div>
                {chainReason && (
                  <Text className={styles.mono}>Chain: {chainReason}</Text>
                )}
                <Divider />
                <div className={styles.grid}>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Claim digest
                    </Text>
                    <Text className={styles.mono}>{result.facts.claimDigest}</Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Algorithm
                    </Text>
                    <Text className={styles.mono}>{result.facts.algorithm?.name ?? '—'}</Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Signed statement length
                    </Text>
                    <Text className={styles.mono}>{result.facts.signedStatementLength} bytes</Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Subject
                    </Text>
                    <Text className={styles.mono}>{result.facts.cwt.sub ?? '—'}</Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Signer
                    </Text>
                    <Text className={styles.mono}>{result.facts.leafSubject ?? '—'}</Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Certificate chain
                    </Text>
                    <Text className={styles.mono}>
                      {result.facts.certificateChainLength} certificates
                    </Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Receipts present / verified
                    </Text>
                    <Text className={styles.mono}>
                      {result.facts.receiptsPresent} / {result.facts.verifiedReceiptCount}
                    </Text>
                  </div>
                  <div>
                    <Text weight="semibold" block size={300}>
                      Keys in set
                    </Text>
                    <Text className={styles.mono}>{result.facts.keySet.keyCount}</Text>
                  </div>
                  {result.facts.chainValidation.status === 'evaluated' &&
                    result.facts.chainValidation.outcome === 'valid' && (
                      <div>
                        <Text weight="semibold" block size={300}>
                          Chain root (SHA-256)
                        </Text>
                        <Text className={styles.mono}>{result.facts.chainValidation.rootSha256}</Text>
                      </div>
                    )}
                </div>

                {result.facts.problems.length > 0 && (
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      {result.facts.problems.map((problem) => (
                        <Text key={problem} block size={300}>
                          {problem}
                        </Text>
                      ))}
                    </MessageBarBody>
                  </MessageBar>
                )}
              </div>
            </Card>

            {result.facts.receipts.map((receipt, index) => (
              <ReceiptCard key={`${receipt.kid ?? 'receipt'}-${index}`} receipt={receipt} index={index} />
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default MstReceiptVerificationPage;
