/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import React, { useMemo } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowDownload20Regular,
  Certificate20Regular,
  Checkmark12Filled,
  DocumentData20Regular,
  DocumentSignature20Regular,
  Dismiss12Filled,
  QuestionCircle12Regular,
  Receipt20Regular,
  ShieldCheckmark28Filled,
  ShieldDismiss24Filled,
  ShieldQuestion24Filled,
  WrenchScrewdriver20Regular,
} from '@fluentui/react-icons';
import type { ChainValidationJson, LookupResult, VerdictKind } from '../types/lookup-types';
import { registrationTxId } from '../utils/lookup-verdict';
import { download } from '../utils/download';
import { isJsonPayload, payloadBytes } from '../utils/claim-decode';
import { CopyButton } from './CopyButton';
import { DecodeClaimCard } from './DecodeClaimCard';

const PAYLOAD_PREVIEW_CHARS = 20_000;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: '16px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, max-content) 1fr',
    columnGap: '16px',
    rowGap: '6px',
  },
  label: { color: tokens.colorNeutralForeground3 },
  value: { fontFamily: tokens.fontFamilyMonospace, wordBreak: 'break-all' },
  valueCell: { display: 'flex', alignItems: 'flex-start', gap: '2px', minWidth: 0 },
  copy: { marginTop: '-4px', flexShrink: 0 },
  cardIcon: { color: tokens.colorBrandForeground1, display: 'flex' },
  verdict: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '16px 20px',
    borderRadius: tokens.borderRadiusLarge,
  },
  verdictSuccess: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
    color: tokens.colorPaletteGreenForeground1,
  },
  verdictError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    color: tokens.colorPaletteRedForeground1,
  },
  verdictWarning: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    color: tokens.colorPaletteDarkOrangeForeground1,
  },
  verdictIcon: { flexShrink: 0, fontSize: '40px', display: 'flex' },
  verdictBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexGrow: 1,
    minWidth: 0,
    color: tokens.colorNeutralForeground1,
  },
  verdictRef: { fontFamily: tokens.fontFamilyMonospace, wordBreak: 'break-all', color: tokens.colorNeutralForeground2 },
  command: { display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' },
  payload: {
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

const VERDICT_STYLE: Record<VerdictKind, 'verdictSuccess' | 'verdictError' | 'verdictWarning'> = {
  verified: 'verdictSuccess',
  failed: 'verdictError',
  keySetMismatch: 'verdictError',
  cannotEvaluate: 'verdictWarning',
};

const VERDICT_ICON: Record<VerdictKind, React.ReactElement> = {
  verified: <ShieldCheckmark28Filled />,
  failed: <ShieldDismiss24Filled />,
  keySetMismatch: <ShieldDismiss24Filled />,
  cannotEvaluate: <ShieldQuestion24Filled />,
};

/** A tri-state check: `null` means it did not run, which is shown as such and never as a pass. */
const Check: React.FC<{ value: boolean | null | undefined }> = ({ value }) => {
  if (value === true) return <Badge color="success" appearance="tint" icon={<Checkmark12Filled />}>pass</Badge>;
  if (value === false) return <Badge color="danger" appearance="tint" icon={<Dismiss12Filled />}>fail</Badge>;
  return <Badge color="informative" appearance="tint" icon={<QuestionCircle12Regular />}>not evaluated</Badge>;
};

/** Chain validation against the statement's own root; a valid chain is labelled as not externally anchored. */
const ChainStatus: React.FC<{ chain: ChainValidationJson | undefined }> = ({ chain }) => {
  if (!chain || chain.status !== 'evaluated') return <Check value={null} />;
  if (chain.outcome === 'valid') {
    return (
      <>
        <Badge color="success" appearance="tint" icon={<Checkmark12Filled />}>valid</Badge>{' '}
        {chain.anchoredExternally ? 'to a trusted root' : "to the statement's own root, not anchored externally"}
      </>
    );
  }
  if (chain.outcome === 'invalid') {
    return <><Badge color="danger" appearance="tint" icon={<Dismiss12Filled />}>invalid</Badge> {chain.reason}</>;
  }
  return (
    <>
      <Badge color="informative" appearance="tint" icon={<QuestionCircle12Regular />}>{chain.outcome ?? 'not evaluated'}</Badge>{' '}
      {chain.reason}
    </>
  );
};

const Row: React.FC<{ label: string; copy?: boolean; children: React.ReactNode }> = ({ label, copy, children }) => {
  const styles = useStyles();
  const copyable = copy && (typeof children === 'string' || typeof children === 'number');
  return (
    <>
      <Text className={styles.label}>{label}</Text>
      <div className={styles.valueCell}>
        <Text className={styles.value}>{children ?? '—'}</Text>
        {copyable && (
          <span className={styles.copy}>
            <CopyButton value={String(children)} what={label.toLowerCase()} />
          </span>
        )}
      </div>
    </>
  );
};

const SectionHeader: React.FC<{ icon: React.ReactElement; title: string }> = ({ icon, title }) => {
  const styles = useStyles();
  return (
    <CardHeader
      image={<span className={styles.cardIcon}>{icon}</span>}
      header={<Text weight="semibold">{title}</Text>}
    />
  );
};

const formatTime = (seconds: number | null | undefined) =>
  seconds == null ? null : `${new Date(seconds * 1000).toISOString()} (${seconds})`;

/** Everything established about one entry: the verdict first, then the facts behind it. */
export const LookupResultView: React.FC<{ result: LookupResult }> = ({ result }) => {
  const styles = useStyles();
  const { verification: v, inspection, payload, verdict } = result;
  // Show the receipt that verified, when one did. Verification skips receipts
  // it cannot parse, so its list is not index-aligned with the inspection's.
  const receipt = v.receipts?.find((r) => r.fullyVerified) ?? v.receipts?.[0];
  const receiptSummary =
    inspection.receipts.find((s) => receipt && s.kid === receipt.kid && s.registeredAt === receipt.registeredAt) ??
    inspection.receipts[0];
  const leaf = v.certificateChain?.[0];
  const fileStem = `${result.ledger}-${result.txId}`;
  const verifyCommand = `scitt-verifier verify --statement ${fileStem}.cose --policy policy.json --online`;

  const payloadText = useMemo(() => {
    if (payload.detached) return null;
    const text = payload.text ?? payload.hex ?? '';
    return text.length > PAYLOAD_PREVIEW_CHARS
      ? `${text.slice(0, PAYLOAD_PREVIEW_CHARS)}\n… (${text.length - PAYLOAD_PREVIEW_CHARS} more characters; download the statement for the full payload)`
      : text;
  }, [payload]);

  // Claims can only be addressed inside a JSON payload; a hash envelope or detached payload has no text.
  const jsonPayload = useMemo(
    () => !payload.detached && !payload.hashEnvelope && isJsonPayload(payload.text),
    [payload],
  );

  return (
    <div className={styles.root}>
      <div className={mergeClasses(styles.verdict, styles[VERDICT_STYLE[verdict.kind]])} role="status">
        <span className={styles.verdictIcon}>{VERDICT_ICON[verdict.kind]}</span>
        <div className={styles.verdictBody}>
          <Text size={500} weight="semibold">{verdict.title}</Text>
          <Text>{verdict.detail}</Text>
          <Text size={200} className={styles.verdictRef}>{result.ledger} · {result.txId}</Text>
        </div>
        <CopyButton link value={() => window.location.href} what="link to this result" />
      </div>

      <Card>
        <SectionHeader icon={<DocumentSignature20Regular />} title="Statement" />
        <div className={styles.grid}>
          <Row label="Issuer (iss)" copy>{inspection.cwt.iss}</Row>
          <Row label="Subject (sub)" copy>{inspection.cwt.sub}</Row>
          <Row label="Issued at (iat)">{formatTime(inspection.cwt.iat)}</Row>
          <Row label="Content type">{inspection.contentType}</Row>
          <Row label="Algorithm">{v.algorithm?.name ?? v.algorithm?.value}</Row>
          <Row label="Signer">{leaf?.subject}</Row>
          <Row label="Signer chain">{v.certificateChain ? `${v.certificateChain.length} certificate(s)` : null}</Row>
          <Row label="Chain validation"><ChainStatus chain={v.chainValidation} /></Row>
          <Row label="Claim digest" copy>{v.claimDigest}</Row>
          <Row label="Issuer signature"><Check value={v.signatureValid} /></Row>
        </div>
        <Text size={200} className={styles.label}>
          The signer certificate chain is validated only up to the root the statement itself carries.
          That shows the chain is internally consistent, not that the root is one you trust; who may sign
          for an issuer is a relying-party policy decision.
        </Text>
      </Card>

      <Card>
        <SectionHeader icon={<Receipt20Regular />} title="Receipt" />
        <div className={styles.grid}>
          <Row label="Registration transaction" copy>{registrationTxId(receiptSummary?.commitEvidence)}</Row>
          <Row label="Signature transaction" copy>{receiptSummary?.ccfTxId}</Row>
          <Row label="Registered at">{formatTime(receiptSummary?.registeredAt)}</Row>
          <Row label="Transparency service">{receiptSummary?.issuer}</Row>
          <Row label="Signing key (kid)" copy>{receiptSummary?.kid}</Row>
          <Row label="Key lookup">{receipt?.keyLookup}</Row>
          <Row label="Root signature"><Check value={receipt?.rootSignatureValid} /></Row>
          <Row label="Bound to statement"><Check value={receipt?.boundToStatement} /></Row>
          <Row label="Receipts present">
            {inspection.receiptsPresent > 1
              ? `${inspection.receiptsPresent} (showing the ${receipt?.fullyVerified ? 'verified' : 'first'} one)`
              : inspection.receiptsPresent}
          </Row>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={<Certificate20Regular />} title="Trust anchor" />
        <div className={styles.grid}>
          <Row label="Service certificate" copy>{v.serviceKey.certificateSha256}</Row>
          <Row label="Service key (kid)" copy>{v.serviceKey.kid}</Row>
          <Row label="Key set bound"><Check value={v.serviceKey.bound} /></Row>
          <Row label="Other served keys">{v.keySet.unvouchedKeyCount}</Row>
        </div>
        <Text size={200} className={styles.label}>
          The service certificate comes from the Azure identity service over public TLS. Keys and
          statements are read through a proxy that is trusted for nothing: only the key bound to that
          certificate is used, and any other key it serves is ignored.
        </Text>
      </Card>

      <Card>
        <SectionHeader icon={<DocumentData20Regular />} title="Payload" />
        {payload.detached && <Text>The payload is detached: it travels separately from the statement.</Text>}
        {payload.hashEnvelope && (
          <div className={styles.grid}>
            <Row label="Hash envelope">{payload.hashEnvelope.hashAlg}</Row>
            <Row label="Artifact digest" copy>{payload.hashEnvelope.digest}</Row>
            <Row label="Artifact type">{payload.hashEnvelope.preimageContentType}</Row>
            <Row label="Artifact location" copy>{payload.hashEnvelope.preimageLocation}</Row>
          </div>
        )}
        {!payload.detached && !payload.hashEnvelope && (
          <>
            <div className={styles.grid}>
              <Row label="Length">{payload.length != null ? `${payload.length} bytes` : null}</Row>
              <Row label="SHA-256" copy>{payload.sha256}</Row>
            </div>
            <pre className={styles.payload}>{payloadText}</pre>
            <div className={styles.actions}>
              <Button
                icon={<ArrowDownload20Regular />}
                onClick={() =>
                  download(
                    `${fileStem}-payload.${jsonPayload ? 'json' : 'bin'}`,
                    payloadBytes(payload),
                    payload.contentType ?? 'application/octet-stream',
                  )
                }
              >
                Payload
              </Button>
            </div>
          </>
        )}
      </Card>

      {jsonPayload && (
        <DecodeClaimCard
          statement={result.statement}
          payloadText={payload.text ?? null}
          fileStem={fileStem}
          verified={verdict.kind === 'verified'}
        />
      )}

      <Card>
        <SectionHeader icon={<WrenchScrewdriver20Regular />} title="Verify it yourself" />
        <div className={styles.actions}>
          <Button icon={<ArrowDownload20Regular />} onClick={() => download(`${fileStem}.cose`, result.statement, 'application/cose')}>
            Statement (.cose)
          </Button>
          <Button icon={<ArrowDownload20Regular />} onClick={() => download(`${result.ledger}-scitt-keys.cbor`, result.keySet, 'application/cbor')}>
            Key set (.cbor)
          </Button>
          <Button icon={<ArrowDownload20Regular />} onClick={() => download(`${result.ledger}-service-cert.pem`, result.serviceCertPem, 'application/x-pem-file')}>
            Service certificate (.pem)
          </Button>
        </div>
        <Text size={200} className={styles.label}>
          Check the statement independently with{' '}
          <a href="https://github.com/microsoft/scitt-verifier" target="_blank" rel="noreferrer">scitt-verifier</a>:
        </Text>
        <div className={styles.command}>
          <code>{verifyCommand}</code>
          <CopyButton value={verifyCommand} what="command" />
        </div>
      </Card>
    </div>
  );
};
