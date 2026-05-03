# @eleata/peppol

> Node SDK for the [eleata Peppol API](https://peppol.eleata.io). Validate
> EU invoices (Peppol BIS 3, XRechnung, Factur-X, UBL) in 5 lines.

[![npm](https://img.shields.io/npm/v/@eleata/peppol.svg)](https://www.npmjs.com/package/@eleata/peppol)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Install

```bash
npm install @eleata/peppol
```

## Usage

```typescript
import { Eleata } from "@eleata/peppol";
import fs from "node:fs";

const client = new Eleata({ apiKey: process.env.ELEATA_KEY! });

const result = await client.validate({
  format: "xrechnung-2.x",
  xml: fs.readFileSync("./invoice.xml"),
});

if (!result.valid) {
  console.error("Invalid:", result.errors);
  process.exit(1);
}
console.log(`✓ Valid (${result.duration_ms}ms) — ${result.report_url}`);
```

## Defaults

- **Timeout**: 15 seconds
- **Retries**: 3 with exponential backoff (200ms, 800ms, 3.2s)
- **Max payload**: 5 MB (rejected client-side before sending)
- **Base URL**: `https://api.eleata.io`

Override:

```typescript
const client = new Eleata({
  apiKey: "...",
  timeout: 30_000,
  maxRetries: 5,
  baseUrl: "https://api.eleata.io",
});
```

## Batch validation

```typescript
const job = await client.validateBatch({
  format: "peppol-bis-3",
  files: invoices.map((xml) => ({ id: xml.id, xml: xml.bytes })),
  webhookUrl: "https://yourapp.com/webhooks/eleata",
});

console.log("Job started:", job.job_id);
// Webhook will POST to webhookUrl when done
```

## Pricing

Free tier: 100 validations/month. Paid plans from €29/mo. See
[peppol.eleata.io/pricing](https://peppol.eleata.io/pricing).

## License

MIT
