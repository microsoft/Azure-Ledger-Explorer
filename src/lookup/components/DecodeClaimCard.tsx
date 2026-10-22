/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowDownload20Regular,
  Checkmark12Filled,
  Dismiss12Filled,
  DocumentSearch20Regular,
  Code20Regular,
} from '@fluentui/react-icons';
import {
  claimBytes,
  publishedDigest,
  runDecode,
  suggestClaim,
  type ClaimEncoding,
  type DecodeOutcome,
} from '../utils/claim-decode';
import { download } from '../utils/download';
import { CopyButton } from './CopyButton';

const PREVIEW_CHARS = 20_000;

const useStyles = makeStyles({
  form: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' },
  path: { flexGrow: 1, minWidth: '260px' },
  pathInput: { fontFamily: tokens.fontFamilyMonospace },
  icon: { color: tokens.colorBrandForeground1, display: 'flex' },
  label: { color: tokens.colorNeutralForeground3 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, max-content) 1fr',
    columnGap: '16px',
    rowGap: '6px',
  },
  value: { fontFamily: tokens.fontFamilyMonospace, wordBreak: 'break-all' },
  valueCell: { display: 'flex', alignItems: 'flex-start', gap: '2px', minWidth: 0 },
  content: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '420px',
    overflow: 'auto',
    margin: 0,
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
});

interface Props {
  statement: Uint8Array;
  payloadText: string | null;
  fileStem: string;
  verified: boolean;
}

/**
 * Decode one encoded claim in the payload, as `scitt-verifier inspect --decode`
 * does. The digest is over the exact decoded bytes, computed by the same Rust
 * code as the CLI, so the two can be compared directly.
 */
export const DecodeClaimCard: React.FC<Props> = ({ statement, payloadText, fileStem, verified }) => {
  const styles = useStyles();
  const suggestion = useMemo(() => suggestClaim(payloadText), [payloadText]);
  const [path, setPath] = useState(suggestion?.path ?? '');
  const [encoding, setEncoding] = useState<ClaimEncoding>(suggestion?.encoding ?? 'base64');
  const [outcome, setOutcome] = useState<DecodeOutcome | null>(null);

  const decode = (event: React.FormEvent) => {
    event.preventDefault();
    setOutcome(runDecode(statement, path, encoding));
  };

  const claim = outcome?.ok ? outcome.claim : null;
  const published = claim ? publishedDigest(payloadText, claim.path) : null;
  const shown = claim ? (claim.text ?? claim.hex ?? '') : '';
  const preview =
    shown.length > PREVIEW_CHARS
      ? `${shown.slice(0, PREVIEW_CHARS)}\n… (${shown.length - PREVIEW_CHARS} more characters; download for the full content)`
      : shown;

  return (
    <Card>
      <CardHeader
        image={<span className={styles.icon}><DocumentSearch20Regular /></span>}
        header={<Text weight="semibold">Decode a payload claim</Text>}
        description={
          <Text size={200} className={styles.label}>
            For a field that carries an encoded document, such as a CCE policy in{' '}
            <code>security-policy-base64</code>. Same as <code>scitt-verifier inspect --decode</code>.
          </Text>
        }
      />
      <form className={styles.form} onSubmit={decode}>
        <Field label="Claim path" className={styles.path} hint="As inspect prints it, e.g. ['security-policy-base64'] or ['a', 'b']">
          <Input
            className={styles.pathInput}
            value={path}
            onChange={(_, d) => setPath(d.value)}
            placeholder="['security-policy-base64']"
            contentBefore={<Code20Regular />}
          />
        </Field>
        <Field label="Encoding">
          <RadioGroup layout="horizontal" value={encoding} onChange={(_, d) => setEncoding(d.value as ClaimEncoding)}>
            <Radio value="base64" label="base64" />
            <Radio value="base64url" label="base64url" />
          </RadioGroup>
        </Field>
        <Button appearance="primary" type="submit" disabled={!path.trim()}>Decode</Button>
      </form>

      {outcome && !outcome.ok && (
        <MessageBar intent="error">
          <MessageBarBody>Could not decode: {outcome.message}</MessageBarBody>
        </MessageBar>
      )}

      {claim && (
        <>
          <MessageBar intent={verified ? 'info' : 'warning'}>
            <MessageBarBody>
              {verified
                ? 'Decoded from the verified statement. Decoding itself checks nothing: these bytes are exactly what the field contains.'
                : 'This statement did not verify. The decoded bytes are what the field contains, not something anyone is shown to have signed.'}
            </MessageBarBody>
          </MessageBar>
          <div className={styles.grid}>
            <Text className={styles.label}>Path</Text>
            <Text className={styles.value}>{claim.path}</Text>
            <Text className={styles.label}>Encoding</Text>
            <Text className={styles.value}>{claim.encoding}</Text>
            <Text className={styles.label}>Decoded length</Text>
            <Text className={styles.value}>{claim.length} bytes{claim.utf8 ? ', UTF-8 text' : ', binary (shown as hex)'}</Text>
            <Text className={styles.label}>SHA-256</Text>
            <div className={styles.valueCell}>
              <Text className={styles.value}>{claim.sha256}</Text>
              <CopyButton value={claim.sha256} what="SHA-256" />
            </div>
            {published && (
              <>
                <Text className={styles.label}>Published digest</Text>
                <Text>
                  {published === claim.sha256 ? (
                    <Badge color="success" appearance="tint" icon={<Checkmark12Filled />}>matches</Badge>
                  ) : (
                    <Badge color="danger" appearance="tint" icon={<Dismiss12Filled />}>differs</Badge>
                  )}{' '}
                  <span className={styles.value}>{published}</span>
                </Text>
              </>
            )}
          </div>
          <pre className={styles.content}>{preview}</pre>
          <div className={styles.actions}>
            <Button
              icon={<ArrowDownload20Regular />}
              onClick={() => download(`${fileStem}-claim.${claim.utf8 ? 'txt' : 'bin'}`, claimBytes(claim), 'application/octet-stream')}
            >
              Decoded bytes
            </Button>
            {claim.text != null && <CopyButton value={claim.text} what="decoded text" />}
          </div>
        </>
      )}
    </Card>
  );
};
