import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listVerifiedAgreementCatalog,
  safeSessionErrorMessage,
  type ApiAgreementCatalogEntry,
} from "@/lib/api-session";
import { listRules } from "@/lib/timesheet-store";
import {
  AGREEMENT_RULE_SOURCE_LABEL,
  agreementRuleSourceHref,
  type AgreementRule,
  type AgreementRuleSourceKey,
} from "@/lib/agreementRules";
import {
  collectiveAgreements,
  getCollectiveAgreementById,
  publicAgreementPdfHref,
} from "@/lib/collectiveAgreements";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({ meta: [{ title: "Admin — Regelgrundlag" }] }),
  component: RulesPage,
});

const inputClassName =
  "h-10 rounded-lg border-slate-200 bg-white text-slate-950 shadow-sm focus-visible:ring-blue-100";

function RulesPage() {
  const [rules, setRules] = useState(listRules);
  const [selectedId, setSelectedId] = useState(rules[0]?.agreementId ?? "");
  const [message, setMessage] = useState("");
  const [serverCatalog, setServerCatalog] = useState<ApiAgreementCatalogEntry[]>([]);
  const [serverCatalogMessage, setServerCatalogMessage] = useState(
    "Henter det servervaliderede katalog…",
  );
  const [sourcePageInputs, setSourcePageInputs] = useState<Record<string, string>>({});
  const rule = rules.find((item) => item.agreementId === selectedId);
  const agreement = rule ? getCollectiveAgreementById(rule.agreementId) : undefined;

  useEffect(() => {
    let cancelled = false;
    listVerifiedAgreementCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setServerCatalog(catalog);
        setServerCatalogMessage(
          catalog.length
            ? `${catalog.length} katalogposter er hentet fra D1.`
            : "Demoorganisationen indeholder ingen juridiske aftaler.",
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setServerCatalog([]);
        setServerCatalogMessage(safeSessionErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<AgreementRule>) => {
    setRules((current) =>
      current.map((item) => (item.agreementId === selectedId ? { ...item, ...patch } : item)),
    );
  };
  const updateSource = (
    field: AgreementRuleSourceKey,
    patch: { pages?: number[]; pdfUrl?: string; pdfFileName?: string },
  ) => {
    if (!rule) return;
    const existingSources = rule.sources.filter((source) => source.field === field);
    const existing = existingSources[0];
    const pdfUrl = patch.pdfUrl ?? existing?.pdfUrl ?? agreement?.pdfUrl ?? "";
    const pdfFileName = patch.pdfFileName ?? existing?.pdfFileName ?? agreement?.pdfFileName ?? "";
    const pages = patch.pages ?? existingSources.map((source) => source.page);
    const otherSources = rule.sources.filter((source) => source.field !== field);

    if (pages.length === 0 || !pdfUrl.trim()) {
      update({ sources: otherSources });
      return;
    }

    update({
      sources: [
        ...otherSources,
        ...pages.map((page) => ({
          field,
          page,
          pdfUrl: pdfUrl.trim(),
          pdfFileName: pdfFileName.trim() || undefined,
        })),
      ],
    });
  };
  const save = () => {
    setMessage("Browserlagring er deaktiveret. Brug det auditerede D1-flow.");
  };

  return (
    <AppShell
      allow={["admin"]}
      dashboard={{
        title: "Overenskomstregler",
        subtitle: "Vedligehold det regelgrundlag, som bruges i adminberegningen.",
      }}
    >
      <InfoBanner tone="warning">
        Systemet indeholder ingen forudfyldte satser. Indtast kun verificerede regler fra den
        gældende overenskomst, og angiv gyldighedsperioden.
      </InfoBanner>
      <ServerAgreementCatalog entries={serverCatalog} message={serverCatalogMessage} />
      <InfoBanner tone="warning">
        Den tidligere browserbaserede regelvisning nedenfor er kun historisk reference og er
        skrivebeskyttet. Juridiske regler og satser må kun aktiveres gennem et auditeret,
        servervalideret D1-flow.
      </InfoBanner>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="max-h-[720px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          {collectiveAgreements.map((agreement) => (
            <button
              key={agreement.id}
              onClick={() => setSelectedId(agreement.id)}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selectedId === agreement.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              <span className="block font-medium">{agreement.name}</span>
              <span className="block text-xs opacity-80">{agreement.rateValidationStatus}</span>
            </button>
          ))}
        </aside>
        {rule && (
          <fieldset
            disabled
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm disabled:opacity-75 md:p-6"
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-950">
                {agreement?.name ?? rule.agreementId}
              </h2>
              <div className="mt-1 text-sm text-slate-500">
                {agreement?.industryArea ?? "Ukendt brancheområde"} ·{" "}
                {agreement?.rateValidationStatus ?? "missing_pdf"}
              </div>
              {agreement?.pdfUrl && (
                <a
                  href={publicAgreementPdfHref(agreement.pdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                >
                  Åbn PDF-kilde →
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Normal daglig arbejdstid (timer)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rule.normalDayHours ?? ""}
                  className={inputClassName}
                  onChange={(e) =>
                    update({ normalDayHours: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Normal ugentlig arbejdstid (timer)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rule.normalWeekHours ?? ""}
                  className={inputClassName}
                  onChange={(e) =>
                    update({ normalWeekHours: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Gyldig fra">
                <Input
                  type="date"
                  value={rule.validFrom}
                  className={inputClassName}
                  onChange={(e) => update({ validFrom: e.target.value })}
                />
              </Field>
              <Field label="Gyldig til">
                <Input
                  type="date"
                  value={rule.validTo}
                  className={inputClassName}
                  onChange={(e) => update({ validTo: e.target.value })}
                />
              </Field>
              <Field label="Aften starter">
                <Input
                  type="time"
                  value={rule.eveningStart}
                  className={inputClassName}
                  onChange={(e) => update({ eveningStart: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nat starter">
                  <Input
                    type="time"
                    value={rule.nightStart}
                    className={inputClassName}
                    onChange={(e) => update({ nightStart: e.target.value })}
                  />
                </Field>
                <Field label="Nat slutter">
                  <Input
                    type="time"
                    value={rule.nightEnd}
                    className={inputClassName}
                    onChange={(e) => update({ nightEnd: e.target.value })}
                  />
                </Field>
              </div>
              <TextField
                label="Overarbejdsregel"
                value={rule.overtimeRule}
                onChange={(value) => update({ overtimeRule: value })}
              />
              <TextField
                label="Lørdagstillæg"
                value={rule.saturdayRule}
                onChange={(value) => update({ saturdayRule: value })}
              />
              <TextField
                label="Søndagstillæg"
                value={rule.sundayRule}
                onChange={(value) => update({ sundayRule: value })}
              />
              <TextField
                label="Aftentillæg"
                value={rule.eveningRule}
                onChange={(value) => update({ eveningRule: value })}
              />
              <TextField
                label="Nattillæg"
                value={rule.nightRule}
                onChange={(value) => update({ nightRule: value })}
              />
              <TextField
                label="Skifteholdstillæg"
                value={rule.shiftRule}
                onChange={(value) => update({ shiftRule: value })}
              />
              <TextField
                label="Særlige tillæg / noter"
                value={rule.specialRule}
                onChange={(value) => update({ specialRule: value })}
                className="md:col-span-2"
              />
            </div>
            <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="font-semibold text-slate-950">Kildehenvisninger til PDF</h3>
              <p className="mt-1 text-sm text-slate-500">
                Angiv den faktiske PDF-side eller sideinterval, hvor reglen eller tillægget er
                fundet. Linkene åbner direkte på siderne, fx 38-40 hvis reglen fortsætter over flere
                sider.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3">
                {(Object.keys(AGREEMENT_RULE_SOURCE_LABEL) as AgreementRuleSourceKey[]).map(
                  (field) => {
                    const sources = rule.sources.filter((item) => item.field === field);
                    const source = sources[0];
                    const pageInputKey = `${selectedId}:${field}`;
                    return (
                      <div
                        key={field}
                        className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[220px_1fr_120px_auto]"
                      >
                        <div className="text-sm font-semibold text-slate-700">
                          {AGREEMENT_RULE_SOURCE_LABEL[field]}
                        </div>
                        <Input
                          value={source?.pdfUrl ?? agreement?.pdfUrl ?? ""}
                          placeholder="https://officiel-udgiver.example/aftale.pdf"
                          className={inputClassName}
                          onChange={(e) =>
                            updateSource(field, {
                              pdfUrl: e.target.value,
                              pdfFileName: e.target.value.split("/").pop() ?? "",
                            })
                          }
                        />
                        <PdfPageInput
                          value={
                            sourcePageInputs[pageInputKey] ??
                            formatPdfSourcePageInput(sources.map((item) => item.page))
                          }
                          placeholder="Side, fx 38-40 eller 39-40-41"
                          onCommit={(value) => {
                            setSourcePageInputs((current) => ({
                              ...current,
                              [pageInputKey]: value,
                            }));

                            updateSource(field, {
                              pages: parsePageInput(value),
                            });
                          }}
                        />
                        <div className="flex items-center justify-end">
                          {sources.length > 0 ? (
                            <div className="space-y-1 text-right">
                              {sources.map((item) => (
                                <a
                                  key={`${item.pdfUrl}-${item.page}`}
                                  href={agreementRuleSourceHref(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                                >
                                  Åbn side {item.page} →
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">Ingen kilde</span>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">{message}</span>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>
                Serveropdatering kræver valideret D1-flow
              </Button>
            </div>
          </fieldset>
        )}
      </div>
    </AppShell>
  );
}

function ServerAgreementCatalog({
  entries,
  message,
}: {
  entries: ApiAgreementCatalogEntry[];
  message: string;
}) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Servervalideret overenskomstkatalog
          </h2>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          D1 er autoritativ
        </span>
      </div>
      {entries.length > 0 && (
        <div className="mt-4 space-y-3">
          {entries.map((entry) => (
            <details key={entry.id} className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{entry.exactTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {entry.agreementParties} · {entry.catalogKey}
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {entry.catalogStatus}
                  </span>
                </div>
              </summary>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <CatalogField label="Arbejdsgiverorganisation">
                  {entry.employerOrganization || "Kræver manuel validering"}
                </CatalogField>
                <CatalogField label="Medarbejderkategori">{entry.employeeCategory}</CatalogField>
                <CatalogField label="Fagligt scope">{entry.coveredWorkAreas}</CatalogField>
                <CatalogField label="Geografisk scope">{entry.geographyScope}</CatalogField>
              </dl>
              <div className="mt-4 space-y-3">
                {entry.versions.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    Ingen verificeret version. Kræver manuel afklaring – beregning og eksport er
                    blokeret.
                  </div>
                ) : (
                  entry.versions.map((version) => (
                    <div key={version.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <div className="font-semibold text-slate-900">
                        Version {version.versionLabel} · {version.validFrom} –{" "}
                        {version.validTo || "ingen verificeret slutdato"}
                      </div>
                      <div className="mt-1 text-slate-600">
                        Implementering: {version.implementationStatus} · Kildekontrol:{" "}
                        {version.verificationStatus} · Godkendte lokale overrides:{" "}
                        {version.approvedOverrideCount}
                      </div>
                      <div className="mt-2 space-y-1">
                        {version.sources.map((source) => (
                          <a
                            key={source.id}
                            href={source.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block font-semibold text-blue-700 hover:underline"
                          >
                            {source.documentTitle} · {source.verificationStatus} →
                          </a>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function CatalogField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-slate-700">{label}</dt>
      <dd className="mt-1 text-slate-600">{children}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function formatPdfSourcePageInput(pages: number[]) {
  return [...new Set(pages)]
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((a, b) => a - b)
    .join("-");
}

function PdfPageInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(value);
    }
  }, [value, isFocused]);

  return (
    <input
      type="text"
      value={draftValue}
      placeholder={placeholder}
      inputMode="text"
      className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      onFocus={() => setIsFocused(true)}
      onChange={(event) => {
        setDraftValue(event.currentTarget.value);
      }}
      onBlur={(event) => {
        const finalValue = event.currentTarget.value;

        setIsFocused(false);
        setDraftValue(finalValue);
        onCommit(finalValue);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function parsePageInput(value: string) {
  const pages = value
    .replace(/\btil\b/gi, "-")
    .split(",")
    .flatMap((part) => {
      const trimmed = part.trim();

      if (!trimmed) return [];

      if (/[-–]\s*$/.test(trimmed)) {
        return [];
      }

      const hyphenPages = trimmed
        .split(/[-–]/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (hyphenPages.length > 1 && hyphenPages.every((item) => /^\d+$/.test(item))) {
        return hyphenPages.map(Number);
      }

      if (/^\d+$/.test(trimmed)) {
        return [Number(trimmed)];
      }

      return [];
    })
    .filter((page) => Number.isInteger(page) && page > 0);

  return [...new Set(pages)].sort((a, b) => a - b);
}
