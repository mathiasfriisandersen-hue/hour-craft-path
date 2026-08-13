import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const auditPath = resolve(repositoryRoot, "legal-sources/agreement-source-audit.json");
const audit = JSON.parse(readFileSync(auditPath, "utf8"));
const remote = process.argv.includes("--remote");
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceStatuses = new Set([
  "manual_review_required",
  "out_of_scope",
  "source_conflict",
  "verified_not_implemented",
]);

assert.equal(audit.schemaVersion, 1, "Ukendt auditformat");
assert.equal(audit.agreements.length, 30, "Auditregisteret skal indeholde præcis 30 poster");

const catalogKeys = audit.agreements.map((agreement) => agreement.catalogKey);
assert.equal(
  new Set(catalogKeys).size,
  30,
  "Auditregisteret indeholder dublerede catalogKey-værdier",
);

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function verifyHash(value, label) {
  assert.match(value, sha256Pattern, `${label} mangler gyldig SHA-256`);
}

for (const agreement of audit.agreements) {
  assert.ok(agreement.title?.trim(), `${agreement.catalogKey}: titel mangler`);
  assert.ok(agreement.period?.trim(), `${agreement.catalogKey}: periode mangler`);
  assert.ok(agreement.parties?.trim(), `${agreement.catalogKey}: parter mangler`);
  assert.ok(agreement.sourceStatus?.trim(), `${agreement.catalogKey}: kildestatus mangler`);
  assert.ok(agreement.rateStatus?.trim(), `${agreement.catalogKey}: satsstatus mangler`);
  assert.ok(
    sourceStatuses.has(agreement.sourceStatus),
    `${agreement.catalogKey}: ukendt kildestatus`,
  );

  if (agreement.officialUrl) {
    assert.match(
      agreement.officialUrl,
      /^https:\/\//u,
      `${agreement.catalogKey}: ugyldig officiel URL`,
    );
    verifyHash(agreement.sha256, `${agreement.catalogKey}: hovedkilde`);
  }

  if (agreement.sourceStatus === "verified_not_implemented") {
    assert.ok(
      agreement.officialUrl,
      `${agreement.catalogKey}: verificeret post mangler officiel URL`,
    );
    verifyHash(agreement.sha256, `${agreement.catalogKey}: verificeret hovedkilde`);
  }

  if (agreement.localFile) {
    const localPath = resolve(repositoryRoot, agreement.localFile);
    assert.ok(existsSync(localPath), `${agreement.catalogKey}: lokal kilde mangler`);
    verifyHash(agreement.localSha256, `${agreement.catalogKey}: lokal kilde`);
    const actualLocalHash = hashBuffer(readFileSync(localPath));
    assert.equal(
      actualLocalHash,
      agreement.localSha256,
      `${agreement.catalogKey}: lokal SHA-256 er ændret`,
    );
    if (agreement.localMatchesOfficial === true) {
      assert.equal(
        actualLocalHash,
        agreement.sha256,
        `${agreement.catalogKey}: lokal og officiel kilde afviger`,
      );
    }
    if (agreement.localMatchesOfficial === false) {
      assert.notEqual(
        actualLocalHash,
        agreement.sha256,
        `${agreement.catalogKey}: registreret kildedrift findes ikke længere`,
      );
      assert.match(
        agreement.rateStatus,
        /manual_review_required/u,
        `${agreement.catalogKey}: kildedrift skal blokere satsvalidering`,
      );
    }
  }

  for (const source of agreement.rateSources ?? []) {
    assert.match(
      source.officialUrl,
      /^https:\/\//u,
      `${agreement.catalogKey}: ugyldig satskilde-URL`,
    );
    verifyHash(source.sha256, `${agreement.catalogKey}: ${source.title}`);
  }
}

async function verifyRemoteSource(label, url, expectedHash) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  assert.ok(response.ok, `${label}: HTTP ${response.status}`);
  const actualHash = hashBuffer(Buffer.from(await response.arrayBuffer()));
  assert.equal(actualHash, expectedHash, `${label}: officiel SHA-256 er ændret`);
}

if (remote) {
  const sources = audit.agreements.flatMap((agreement) => [
    ...(agreement.officialUrl
      ? [{ label: agreement.catalogKey, url: agreement.officialUrl, sha256: agreement.sha256 }]
      : []),
    ...(agreement.rateSources ?? []).map((source) => ({
      label: `${agreement.catalogKey}/${source.title}`,
      url: source.officialUrl,
      sha256: source.sha256,
    })),
  ]);
  for (let index = 0; index < sources.length; index += 4) {
    await Promise.all(
      sources
        .slice(index, index + 4)
        .map((source) => verifyRemoteSource(source.label, source.url, source.sha256)),
    );
  }
}

const statusCounts = Object.fromEntries(
  Object.entries(
    audit.agreements.reduce((counts, agreement) => {
      counts[agreement.sourceStatus] = (counts[agreement.sourceStatus] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right)),
);

console.log(`PASS agreement source audit (${audit.agreements.length}/30 poster)`);
console.log(`PASS lokale kildehashes${remote ? " og officielle fjernkilder" : ""}`);
console.log(JSON.stringify(statusCounts));
