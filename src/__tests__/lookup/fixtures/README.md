# Lookup test fixtures

Copied unchanged from
[microsoft/scitt-verifier](https://github.com/microsoft/scitt-verifier) `corpus/fixtures` at
commit `0731a67c9372708235ac323e254f8fef54b80fc4` (MIT). See that directory's README for how
they were produced.

| File | Role |
|---|---|
| `transparent-statement.cose` | Genuine statement with one receipt from the `mst-test-scitt-verifier` ledger |
| `tampered-statement.cose` | The same statement with one byte flipped inside the receipt: the issuer signature still verifies, the receipt does not |
| `mst-test-scitt-keys.cbor` | That ledger's key set; contains the service key |
| `other-service-scitt-keys.cbor` | A different service's key set; does not contain the service key |
| `mst-test-service-cert.pem` | That ledger's service certificate, as published by the identity service |
| `image-reproduction-statement.cose` | `image-reproduction/statement.cose` at commit `d47cbb27d8ee5d561a2b6328aee28842c5c007cb`: a JSON payload, used to test decoding a payload claim |
