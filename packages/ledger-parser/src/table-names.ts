/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * Canonical CCF table-name constants.
 *
 * These live in the lowest-level package (`ledger-parser`) so that both
 * `ccf-database` and the application layer can import them without creating
 * circular dependencies.
 */

// ---------------------------------------------------------------------------
// Table-name prefixes (used for classification / grouping)
// ---------------------------------------------------------------------------

export const CCF_TABLE_PREFIXES = {
  /** Any public-domain table. */
  PUBLIC: 'public:',
  /** Current (5.0+) governance tables. */
  GOV: 'public:ccf.gov.',
  /** CCF internal bookkeeping tables. */
  INTERNAL: 'public:ccf.internal.',
} as const;

// ---------------------------------------------------------------------------
// Governance tables  (public:ccf.gov.*)
// ---------------------------------------------------------------------------

export const CCF_GOV_TABLES = {
  // Members
  MEMBERS_CERTS: 'public:ccf.gov.members.certs',
  MEMBERS_ENCRYPTION_PUBLIC_KEYS: 'public:ccf.gov.members.encryption_public_keys',
  MEMBERS_INFO: 'public:ccf.gov.members.info',
  MEMBERS_ACKS: 'public:ccf.gov.members.acks',

  // Users
  USERS_CERTS: 'public:ccf.gov.users.certs',
  USERS_INFO: 'public:ccf.gov.users.info',

  // Nodes
  NODES_INFO: 'public:ccf.gov.nodes.info',
  NODES_ENDORSED_CERTIFICATES: 'public:ccf.gov.nodes.endorsed_certificates',
  NODES_CODE_IDS: 'public:ccf.gov.nodes.code_ids',
  NODES_VIRTUAL_HOST_DATA: 'public:ccf.gov.nodes.virtual.host_data',
  NODES_VIRTUAL_MEASUREMENTS: 'public:ccf.gov.nodes.virtual.measurements',
  NODES_SNP_HOST_DATA: 'public:ccf.gov.nodes.snp.host_data',
  NODES_SNP_MEASUREMENTS: 'public:ccf.gov.nodes.snp.measurements',
  NODES_SNP_UVM_ENDORSEMENTS: 'public:ccf.gov.nodes.snp.uvm_endorsements',
  NODES_SNP_TCB_VERSIONS: 'public:ccf.gov.nodes.snp.tcb_versions',

  // Service
  SERVICE_INFO: 'public:ccf.gov.service.info',
  SERVICE_CONFIG: 'public:ccf.gov.service.config',
  SERVICE_PREVIOUS_SERVICE_IDENTITY: 'public:ccf.gov.service.previous_service_identity',

  // Proposals
  PROPOSALS: 'public:ccf.gov.proposals',
  PROPOSALS_INFO: 'public:ccf.gov.proposals_info',

  // Modules & JS runtime
  MODULES: 'public:ccf.gov.modules',
  MODULES_QUICKJS_BYTECODE: 'public:ccf.gov.modules_quickjs_bytecode',
  MODULES_QUICKJS_VERSION: 'public:ccf.gov.modules_quickjs_version',
  JS_RUNTIME_OPTIONS: 'public:ccf.gov.js_runtime_options',
  INTERPRETER_FLUSH: 'public:ccf.gov.interpreter.flush',

  // Endpoints
  ENDPOINTS: 'public:ccf.gov.endpoints',

  // TLS
  TLS_CA_CERT_BUNDLES: 'public:ccf.gov.tls.ca_cert_bundles',

  // JWT
  JWT_ISSUERS: 'public:ccf.gov.jwt.issuers',
  JWT_PUBLIC_SIGNING_KEYS: 'public:ccf.gov.jwt.public_signing_keys',
  JWT_PUBLIC_SIGNING_KEY_ISSUER: 'public:ccf.gov.jwt.public_signing_key_issuer',
  JWT_PUBLIC_SIGNING_KEYS_METADATA: 'public:ccf.gov.jwt.public_signing_keys_metadata',
  JWT_PUBLIC_SIGNING_KEYS_METADATA_V2: 'public:ccf.gov.jwt.public_signing_keys_metadata_v2',

  // Constitution & history
  CONSTITUTION: 'public:ccf.gov.constitution',
  HISTORY: 'public:ccf.gov.history',
  COSE_HISTORY: 'public:ccf.gov.cose_history',
  COSE_RECENT_PROPOSALS: 'public:ccf.gov.cose_recent_proposals',

  // SCITT governance
  SCITT_CONFIGURATION: 'public:ccf.gov.scitt.configuration',
} as const;

// ---------------------------------------------------------------------------
// Internal tables  (public:ccf.internal.*)
// ---------------------------------------------------------------------------

export const CCF_INTERNAL_TABLES = {
  HISTORICAL_ENCRYPTED_LEDGER_SECRET: 'public:ccf.internal.historical_encrypted_ledger_secret',
  ENCRYPTED_LEDGER_SECRETS: 'public:ccf.internal.encrypted_ledger_secrets',
  TREE: 'public:ccf.internal.tree',
  SIGNATURES: 'public:ccf.internal.signatures',
  COSE_SIGNATURES: 'public:ccf.internal.cose_signatures',
  RECOVERY_SHARES: 'public:ccf.internal.recovery_shares',
  SNAPSHOT_EVIDENCE: 'public:ccf.internal.snapshot_evidence',
  ENCRYPTED_SUBMITTED_SHARES: 'public:ccf.internal.encrypted_submitted_shares',
  PREVIOUS_SERVICE_IDENTITY_ENDORSEMENT: 'public:ccf.internal.previous_service_identity_endorsement',
  PREVIOUS_SERVICE_LAST_SIGNED_ROOT: 'public:ccf.internal.previous_service_last_signed_root',
  LAST_RECOVERY_TYPE: 'public:ccf.internal.last_recovery_type',
} as const;

// ---------------------------------------------------------------------------
// SCITT tables
// ---------------------------------------------------------------------------

export const SCITT_TABLES = {
  ENTRY: 'public:scitt.entry',
  OPERATIONS: 'public:scitt.operations',
} as const;

// ---------------------------------------------------------------------------
// Legacy / pre-5.0 table names  (kept for backward-compatible content-type
// detection when viewing older ledger files)
// ---------------------------------------------------------------------------

export const CCF_LEGACY_TABLES = {
  // Pre-5.0 governance namespace (public:ccf.governance.*)
  GOVERNANCE_MODULES: 'public:ccf.governance.modules',
  GOVERNANCE_JS_MODULES: 'public:ccf.governance.js_modules',
  GOVERNANCE_CONSTITUTION: 'public:ccf.governance.constitution',
  GOVERNANCE_SERVICE_CONFIG: 'public:ccf.governance.service_config',
  GOVERNANCE_JWT_ISSUERS: 'public:ccf.governance.jwt_issuers',
  GOVERNANCE_RECOVERY_SHARES: 'public:ccf.governance.recovery_shares',

  // Pre-5.0 node namespace (public:ccf.nodes.*)
  NODES_INFO: 'public:ccf.nodes.info',
  NODES_ENDORSED_CERTIFICATES: 'public:ccf.nodes.endorsed_certificates',
  NODES_SELF_SIGNED_NODE_CERTIFICATE: 'public:ccf.nodes.self_signed_node_certificate',

  // Alternate naming variants (underscores instead of dots in sub-path)
  GOV_JS_MODULES: 'public:ccf.gov.js_modules',
  GOV_TLS_CA_CERT_BUNDLES: 'public:ccf.gov.tls_ca_cert_bundles',
  GOV_SERVICE_CERTIFICATE: 'public:ccf.gov.service_certificate',
  GOV_NETWORK_CERT: 'public:ccf.gov.network_cert',
  GOV_SERVICE_CONFIGURATION: 'public:ccf.gov.service_configuration',
  GOV_JWT_ISSUERS: 'public:ccf.gov.jwt_issuers',
  GOV_JWT_PUBLIC_SIGNING_KEYS: 'public:ccf.gov.jwt_public_signing_keys',
  GOV_JWT_PUBLIC_SIGNING_KEY_ISSUER: 'public:ccf.gov.jwt_public_signing_key_issuer',
  GOV_SERVICE_INFO: 'public:ccf.gov.service_info',

  // Internal tables from older CCF versions
  INTERNAL_NODES: 'public:ccf.internal.nodes',
  INTERNAL_CONSENSUS: 'public:ccf.internal.consensus',
} as const;

// ---------------------------------------------------------------------------
// Table descriptions  (human-readable documentation for each table)
// ---------------------------------------------------------------------------

export const TABLE_DESCRIPTIONS: Record<string, string> = {
    // Governance tables (public:ccf.gov.*)
    [CCF_GOV_TABLES.MEMBERS_CERTS]: 'X509 certificates of all members in the consortium. Key: Member ID (SHA-256 fingerprint). Value: PEM-encoded certificate.',
    [CCF_GOV_TABLES.MEMBERS_ENCRYPTION_PUBLIC_KEYS]: 'Public encryption keys submitted by members. Used to encrypt recovery shares for each member. Key: Member ID. Value: PEM-encoded public key.',
    [CCF_GOV_TABLES.MEMBERS_INFO]: 'Participation status and auxiliary information attached to a member. Key: Member ID. Value: JSON with status (ACCEPTED/ACTIVE), member_data, and optional recovery_role.',
    [CCF_GOV_TABLES.MEMBERS_ACKS]: 'Member acknowledgements of the ledger state, containing signatures over the Merkle root at a particular sequence number. Key: Member ID. Value: JSON with state digest and signed request.',
    [CCF_GOV_TABLES.USERS_CERTS]: 'X509 certificates of all network users. Key: User ID (SHA-256 fingerprint). Value: PEM-encoded certificate.',
    [CCF_GOV_TABLES.USERS_INFO]: 'Auxiliary information attached to a user, such as role information. Key: User ID. Value: JSON with user_data.',
    [CCF_GOV_TABLES.NODES_INFO]: 'Identity, status and attestations of the nodes hosting the network. Key: Node ID (SHA-256 of public key). Value: JSON with quote_info, encryption_pub_key, status, etc.',
    [CCF_GOV_TABLES.NODES_ENDORSED_CERTIFICATES]: 'Service-endorsed certificates for nodes. Key: Node ID. Value: PEM-encoded certificate.',
    [CCF_GOV_TABLES.NODES_CODE_IDS]: 'DEPRECATED. Previously contained allowed code versions for SGX hardware. Key: MRENCLAVE (hex). Value: JSON status.',
    [CCF_GOV_TABLES.NODES_VIRTUAL_HOST_DATA]: 'Map mimicking SNP host_data for virtual nodes, restricting which host_data values may be presented by new joining nodes.',
    [CCF_GOV_TABLES.NODES_VIRTUAL_MEASUREMENTS]: 'Trusted virtual measurements for nodes joining the network. Warning: Should be empty in production (no TEE protection).',
    [CCF_GOV_TABLES.NODES_SNP_HOST_DATA]: 'Trusted attestation report host data for SNP nodes joining the network. Key: Host data. Value: Platform-specific metadata.',
    [CCF_GOV_TABLES.NODES_SNP_MEASUREMENTS]: 'Trusted SNP measurements for new nodes joining the network. Key: Measurement (hex). Value: JSON status.',
    [CCF_GOV_TABLES.NODES_SNP_UVM_ENDORSEMENTS]: 'For Confidential ACI deployments, trusted UVM endorsements for SNP nodes. Key: Trusted endorser DID. Value: JSON map of issuer feed to SVN.',
    [CCF_GOV_TABLES.NODES_SNP_TCB_VERSIONS]: 'Minimum trusted TCB version for SNP nodes. Key: AMD CPUID (hex). Value: Minimum TCB version.',
    [CCF_GOV_TABLES.SERVICE_INFO]: 'Service identity and status. Key: Sentinel value 0. Value: JSON with cert, status (OPENING/OPEN/RECOVERING), recovery_count, etc.',
    [CCF_GOV_TABLES.SERVICE_CONFIG]: 'Service configuration. Key: Sentinel value 0. Value: JSON with maximum_node_certificate_validity_days, recent_cose_proposals_window_size.',
    [CCF_GOV_TABLES.SERVICE_PREVIOUS_SERVICE_IDENTITY]: 'PEM identity of previous service (for recovery). Key: Sentinel value 0. Value: PEM-encoded JSON.',
    [CCF_GOV_TABLES.PROPOSALS]: 'Governance proposals. Key: Proposal ID (SHA-256 of proposal). Value: Raw proposal as submitted.',
    [CCF_GOV_TABLES.PROPOSALS_INFO]: 'Status, proposer ID and ballots for proposals. Key: Proposal ID. Value: JSON with proposer_id, state (OPEN/ACCEPTED/REJECTED/etc), ballots.',
    [CCF_GOV_TABLES.MODULES]: 'JavaScript modules accessible by endpoint functions. Key: Module name. Value: Module contents.',
    [CCF_GOV_TABLES.MODULES_QUICKJS_BYTECODE]: 'JavaScript engine module cache. Key: Module name. Value: Compiled bytecode.',
    [CCF_GOV_TABLES.MODULES_QUICKJS_VERSION]: 'JavaScript engine version of the module cache. Key: Sentinel value 0. Value: QuickJS version string.',
    [CCF_GOV_TABLES.JS_RUNTIME_OPTIONS]: 'QuickJS runtime options for configuring JS runtimes. Key: Sentinel value 0. Value: JSON with heap size, stack size, execution time limits.',
    [CCF_GOV_TABLES.INTERPRETER_FLUSH]: 'Signals the interpreter cache to flush existing instances. Key: Sentinel value 0. Value: Boolean.',
    [CCF_GOV_TABLES.ENDPOINTS]: 'JavaScript endpoint definitions. Key: HTTP method + endpoint path. Value: JSON with mode, forwarding policy, authentication, JS module/function.',
    [CCF_GOV_TABLES.TLS_CA_CERT_BUNDLES]: 'CA cert bundles for authenticating JWT issuer connections. Key: Bundle name. Value: PEM-encoded cert bundle.',
    [CCF_GOV_TABLES.JWT_ISSUERS]: 'JWT issuers configuration. Key: Issuer URL. Value: JSON with ca_cert_bundle_name and auto_refresh flag.',
    [CCF_GOV_TABLES.JWT_PUBLIC_SIGNING_KEYS]: 'JWT signing keys (used until 5.0). Key: JWT Key ID. Value: DER-encoded key or certificate.',
    [CCF_GOV_TABLES.JWT_PUBLIC_SIGNING_KEY_ISSUER]: 'JWT signing key to issuer mapping (used until 5.0). Key: JWT Key ID. Value: Issuer URL.',
    [CCF_GOV_TABLES.JWT_PUBLIC_SIGNING_KEYS_METADATA]: 'JWT signing keys (used until 6.0). Key: JWT Key ID. Value: JSON list of certificate, issuer, constraint.',
    [CCF_GOV_TABLES.JWT_PUBLIC_SIGNING_KEYS_METADATA_V2]: 'JWT signing keys (from 6.0). Key: JWT Key ID. Value: JSON list of public key, issuer, constraint.',
    [CCF_GOV_TABLES.CONSTITUTION]: 'Service constitution: JavaScript module exporting validate(), resolve() and apply() functions. Key: Sentinel value 0. Value: JS module string.',
    [CCF_GOV_TABLES.HISTORY]: 'Governance history capturing signed governance requests submitted by members. Key: Member ID. Value: JSON SignedReq.',
    [CCF_GOV_TABLES.COSE_HISTORY]: 'Governance history capturing COSE Sign1 governance requests submitted by members. Key: Member ID. Value: COSE Sign1.',
    [CCF_GOV_TABLES.COSE_RECENT_PROPOSALS]: 'Window of recent COSE signed proposals for replay prevention. Key: Timestamp + SHA-256 of COSE Sign1. Value: Proposal ID.',
    // Internal tables (public:ccf.internal.*)
    [CCF_INTERNAL_TABLES.HISTORICAL_ENCRYPTED_LEDGER_SECRET]: 'On each rekey, stores the old ledger secret encrypted with the new secret. Public for recovery bootstrap access.',
    [CCF_INTERNAL_TABLES.ENCRYPTED_LEDGER_SECRETS]: 'Used to broadcast ledger secrets between nodes during recovery and ledger rekey. Public for recovery bootstrap access.',
    [CCF_INTERNAL_TABLES.TREE]: 'Serialized Merkle Tree for the ledger between signatures. Used to generate receipts for historical transactions.',
    [CCF_INTERNAL_TABLES.SIGNATURES]: 'Signatures emitted by the primary node over the Merkle Tree root. Key: Sentinel value 0. Value: seqno, view, root hash, node cert.',
    [CCF_INTERNAL_TABLES.COSE_SIGNATURES]: 'COSE signatures emitted by the primary node over the Merkle Tree root. Key: Sentinel value 0. Value: Raw COSE Sign1 message.',
    [CCF_INTERNAL_TABLES.RECOVERY_SHARES]: "Members' recovery shares encrypted by keys in members.encryption_public_keys. Public for recovery bootstrap access.",
    [CCF_INTERNAL_TABLES.SNAPSHOT_EVIDENCE]: 'Evidence inserted by a primary producing a snapshot to establish provenance. Key: Sentinel value 0. Value: Snapshot hash and version.',
    [CCF_INTERNAL_TABLES.ENCRYPTED_SUBMITTED_SHARES]: 'Used to persist submitted shares during recovery. Public for recovery bootstrap access.',
    [CCF_INTERNAL_TABLES.PREVIOUS_SERVICE_IDENTITY_ENDORSEMENT]: 'COSE Sign1 endorsement of previous service identity. Key: Sentinel value 0. Value: Raw COSE Sign1 message.',
    [CCF_INTERNAL_TABLES.PREVIOUS_SERVICE_LAST_SIGNED_ROOT]: 'Last signed Merkle root of previous service instance. Key: Sentinel value 0. Value: Hex-encoded root hash.',
    [CCF_INTERNAL_TABLES.LAST_RECOVERY_TYPE]: 'The mechanism by which the ledger secret was recovered (NONE/RECOVERY_SHARES/LOCAL_UNSEALING).',
    // SCITT tables
    [SCITT_TABLES.ENTRY]: 'SCITT (Supply Chain Integrity, Transparency and Trust) entries. Contains signed statements with issuer, subject, and timestamp claims.',
    [CCF_GOV_TABLES.SCITT_CONFIGURATION]: 'Service configuration including the registration policy and trusted issuers for SCITT entries.',
    [SCITT_TABLES.OPERATIONS]: 'Shows the status of SCITT entry registration.',
};
