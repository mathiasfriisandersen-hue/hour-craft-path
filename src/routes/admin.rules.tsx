import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, InfoBanner } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRules, saveRule } from "@/lib/timesheet-store";
import {
  AGREEMENT_RULE_SOURCE_LABEL,
  agreementRuleSourceHref,
  formatAgreementRulePages,
  type AgreementRule,
  type AgreementRuleSourceKey,
} from "@/lib/agreementRules";
import {
  collectiveAgreements,
  getCollectiveAgreementById,
  publicAgreementPdfHref,
} from "@/lib/collectiveAgreements";
import {
  AGREEMENT_RULE_REVIEW_STATUS_LABEL,
  AGREEMENT_VALIDATION_STATUS_LABEL,
  getAgreementValidationErrors,
  getFailingValidationTests,
  getMissingValidationRules,
  listAgreementValidationReports,
  resetAgreementValidation,
  saveAgreementValidationReport,
  validateAgreementForCalculation,
  type AgreementCalculationType,
  type AgreementRuleCategory,
  type AgreementRuleReviewStatus,
  type AgreementValidationReport,
} from "@/lib/agreementValidation";

export const Route = createFileRoute("/admin/rules")({
  head: () => ({ meta: [{ title: "Admin — Regelgrundlag" }] }),
  component: RulesPage,
});

function RulesPage() {
  const [rules, setRules] = useState(listRules);
  const [validationReports, setValidationReports] = useState(listAgreementValidationReports);
  const [selectedId, setSelectedId] = useState(rules[0]?.agreementId ?? "");
  const [message, setMessage] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [validatedBy, setValidatedBy] = useState("manual-review");
  const [validationNote, setValidationNote] = useState(
    "Satser og regler kontrolleret mod PDF-sidehenvisninger og testcases.",
  );
  const rule = rules.find((item) => item.agreementId === selectedId);
  const agreement = rule ? getCollectiveAgreementById(rule.agreementId) : undefined;
  const validationReport = validationReports.find((item) => item.agreementSlug === selectedId);
  const validationDate = new Date().toISOString().slice(0, 10);

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
    if (!rule) return;
    saveRule(rule);
    setRules(listRules());
    setMessage("Regelgrundlaget er gemt i denne browser.");
    window.setTimeout(() => setMessage(""), 3000);
  };
  const updateValidationReport = (patch: Partial<AgreementValidationReport>) => {
    setValidationReports((current) =>
      current.map((item) =>
        item.agreementSlug === selectedId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };
  const updateValidationRule = (
    ruleKey: AgreementRuleCategory,
    patch: Partial<AgreementValidationReport["rules"][number]>,
  ) => {
    if (!validationReport) return;
    updateValidationReport({
      status: "needs_manual_review",
      validatedForCalculation: false,
      rules: validationReport.rules.map((item) =>
        item.ruleKey === ruleKey ? { ...item, ...patch } : item,
      ),
    });
  };
  const saveValidation = () => {
    if (!validationReport) return;
    const saved = saveAgreementValidationReport(validationReport);
    setValidationReports(listAgreementValidationReports());
    setValidationMessage(`${saved.agreementName}: review gemt i denne browser.`);
    window.setTimeout(() => setValidationMessage(""), 4000);
  };
  const validateSelectedAgreement = () => {
    if (!validationReport) return;
    const result = validateAgreementForCalculation(validationReport, {
      validatedAt: validationDate,
      validatedBy,
      validationNote,
    });
    setValidationReports(listAgreementValidationReports());
    if (!result.ok) {
      setValidationMessage(`Kan ikke validere: ${result.errors.slice(0, 5).join(" ")}`);
      return;
    }
    setValidationMessage(`${result.report.agreementName} er markeret som valideret til beregning.`);
  };
  const resetValidation = () => {
    if (!validationReport) return;
    resetAgreementValidation(validationReport);
    setValidationReports(listAgreementValidationReports());
    setValidationMessage("Validering er nulstillet til manuel gennemgang.");
  };

  return (
    <AppShell allow={["admin"]}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Overenskomstregler</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vedligehold det regelgrundlag, som bruges i adminberegningen.
        </p>
      </div>
      <InfoBanner tone="warning">
        Systemet indeholder ingen forudfyldte satser. Indtast kun verificerede regler fra den
        gældende overenskomst, og angiv gyldighedsperioden.
      </InfoBanner>
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="max-h-[720px] overflow-y-auto rounded-lg border bg-card p-2">
          {collectiveAgreements.map((agreement) => (
            <button
              key={agreement.id}
              onClick={() => setSelectedId(agreement.id)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === agreement.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <span className="block">{agreement.name}</span>
              <span className="block text-xs opacity-80">{agreement.rateValidationStatus}</span>
            </button>
          ))}
        </aside>
        {rule && (
          <section className="rounded-lg border bg-card p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">{agreement?.name ?? rule.agreementId}</h2>
              <div className="mt-1 text-sm text-muted-foreground">
                {agreement?.industryArea ?? "Ukendt brancheområde"} ·{" "}
                {agreement?.rateValidationStatus ?? "missing_pdf"}
              </div>
              {agreement?.pdfUrl && (
                <a
                  href={publicAgreementPdfHref(agreement.pdfUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
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
                  onChange={(e) =>
                    update({ normalWeekHours: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </Field>
              <Field label="Gyldig fra">
                <Input
                  type="date"
                  value={rule.validFrom}
                  onChange={(e) => update({ validFrom: e.target.value })}
                />
              </Field>
              <Field label="Gyldig til">
                <Input
                  type="date"
                  value={rule.validTo}
                  onChange={(e) => update({ validTo: e.target.value })}
                />
              </Field>
              <Field label="Aften starter">
                <Input
                  type="time"
                  value={rule.eveningStart}
                  onChange={(e) => update({ eveningStart: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nat starter">
                  <Input
                    type="time"
                    value={rule.nightStart}
                    onChange={(e) => update({ nightStart: e.target.value })}
                  />
                </Field>
                <Field label="Nat slutter">
                  <Input
                    type="time"
                    value={rule.nightEnd}
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
            <section className="mt-6 rounded-lg border bg-muted/20 p-4">
              <h3 className="font-semibold">Kildehenvisninger til PDF</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Angiv den faktiske PDF-side eller sideinterval, hvor reglen eller tillægget er
                fundet. Linkene åbner direkte på siderne, fx 38-40 hvis reglen fortsætter over flere
                sider.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3">
                {(Object.keys(AGREEMENT_RULE_SOURCE_LABEL) as AgreementRuleSourceKey[]).map(
                  (field) => {
                    const sources = rule.sources.filter((item) => item.field === field);
                    const source = sources[0];
                    return (
                      <div
                        key={field}
                        className="grid grid-cols-1 gap-2 rounded-md border bg-card p-3 md:grid-cols-[220px_1fr_120px_auto]"
                      >
                        <div className="text-sm font-medium">
                          {AGREEMENT_RULE_SOURCE_LABEL[field]}
                        </div>
                        <Input
                          value={source?.pdfUrl ?? agreement?.pdfUrl ?? ""}
                          placeholder="/overenskomster/filnavn.pdf"
                          onChange={(e) =>
                            updateSource(field, {
                              pdfUrl: e.target.value,
                              pdfFileName: e.target.value.split("/").pop() ?? "",
                            })
                          }
                        />
                        <Input
                          value={formatAgreementRulePages(sources.map((item) => item.page))}
                          placeholder="Side, fx 38-40"
                          onChange={(e) =>
                            updateSource(field, {
                              pages: parsePageInput(e.target.value),
                            })
                          }
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
                                  className="block text-sm font-medium text-primary hover:underline"
                                >
                                  Åbn side {item.page} →
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Ingen kilde</span>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
            {validationReport && (
              <ValidationSection
                report={validationReport}
                validatedBy={validatedBy}
                validationDate={validationDate}
                validationMessage={validationMessage}
                validationNote={validationNote}
                onValidatedByChange={setValidatedBy}
                onValidationNoteChange={setValidationNote}
                onRuleChange={updateValidationRule}
                onSave={saveValidation}
                onValidate={validateSelectedAgreement}
                onReset={resetValidation}
              />
            )}
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{message}</span>
              <Button onClick={save}>Gem regler</Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
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
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const REVIEW_STATUS_OPTIONS: AgreementRuleReviewStatus[] = [
  "needs_review",
  "approved",
  "rejected",
  "not_applicable",
];

const CALCULATION_TYPE_OPTIONS: AgreementCalculationType[] = [
  "fixed_rate",
  "percentage",
  "time_condition",
  "manual",
];

const CALCULATION_TYPE_LABEL: Record<AgreementCalculationType, string> = {
  fixed_rate: "Fast sats",
  percentage: "Procent",
  time_condition: "Tidsbetingelse",
  manual: "Manuel vurdering",
};

function ValidationSection({
  report,
  validatedBy,
  validationDate,
  validationMessage,
  validationNote,
  onValidatedByChange,
  onValidationNoteChange,
  onRuleChange,
  onSave,
  onValidate,
  onReset,
}: {
  report: AgreementValidationReport;
  validatedBy: string;
  validationDate: string;
  validationMessage: string;
  validationNote: string;
  onValidatedByChange: (value: string) => void;
  onValidationNoteChange: (value: string) => void;
  onRuleChange: (
    ruleKey: AgreementRuleCategory,
    patch: Partial<AgreementValidationReport["rules"][number]>,
  ) => void;
  onSave: () => void;
  onValidate: () => void;
  onReset: () => void;
}) {
  const missingRules = getMissingValidationRules(report);
  const failingTests = getFailingValidationTests(report);
  const blockers = getAgreementValidationErrors(report, {
    validatedAt: validationDate,
    validatedBy,
    validationNote,
  });
  const needsReviewCount = report.rules.filter(
    (rule) => rule.reviewStatus === "needs_review",
  ).length;

  return (
    <section className="mt-6 rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold">Valideringsworkflow</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Brug denne gennemgang til at dokumentere, hvad der er fundet i PDF’en, hvad der stadig
            mangler review, og om overenskomsten må bruges til automatisk beregning.
          </p>
        </div>
        <div className="rounded-md border bg-card px-3 py-2 text-sm">
          <div className="font-medium">
            {AGREEMENT_VALIDATION_STATUS_LABEL[report.status] ?? report.status}
          </div>
          <div className="text-muted-foreground">
            Automatisk beregning: {report.validatedForCalculation ? "Ja" : "Nej"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <InfoBox label="Kilde-PDF" value={report.sourcePdf || "Mangler"} />
        <InfoBox label="Udtrukket" value={report.extractedAt || "Mangler"} />
        <InfoBox label="Valideret" value={report.validatedAt || "Ikke valideret"} />
        <InfoBox label="Regler til review" value={String(needsReviewCount)} />
      </div>

      {(missingRules.length > 0 || failingTests.length > 0 || blockers.length > 0) && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <div className="font-medium">Blokeringer før validering</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.slice(0, 10).map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
            {blockers.length > 10 && <li>{blockers.length - 10} yderligere punkter skjult.</li>}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {report.rules.map((rule) => (
          <div key={rule.ruleKey} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{rule.label}</h4>
                  {rule.required && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Obligatorisk
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    Confidence: {rule.confidence}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{rule.conditions}</p>
              </div>
              <div className="min-w-[180px]">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rule.reviewStatus}
                  onChange={(event) =>
                    onRuleChange(rule.ruleKey, {
                      reviewStatus: event.target.value as AgreementRuleReviewStatus,
                    })
                  }
                >
                  {REVIEW_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {AGREEMENT_RULE_REVIEW_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[160px_160px_1fr]">
              <Field label="Beregningstype">
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rule.calculationType}
                  onChange={(event) =>
                    onRuleChange(rule.ruleKey, {
                      calculationType: event.target.value as AgreementCalculationType,
                    })
                  }
                >
                  {CALCULATION_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {CALCULATION_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sats">
                <Input
                  type="number"
                  step="0.01"
                  value={rule.rate ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    onRuleChange(rule.ruleKey, {
                      rate: value ? Number(value) : null,
                    });
                  }}
                />
              </Field>
              <Field label="Enhed">
                <Input
                  value={rule.unit ?? ""}
                  onChange={(event) =>
                    onRuleChange(rule.ruleKey, {
                      unit: event.target.value.trim() || null,
                    })
                  }
                />
              </Field>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
              <Field label="PDF-sider">
                <Input
                  value={formatAgreementRulePages(rule.pdfPages)}
                  placeholder="Fx 38-41"
                  onChange={(event) =>
                    onRuleChange(rule.ruleKey, {
                      pdfPages: parsePageInput(event.target.value),
                    })
                  }
                />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium">Direkte links</span>
                <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2">
                  {rule.pdfPages.length ? (
                    rule.pdfPages.map((page) => (
                      <a
                        key={`${rule.ruleKey}-${page}`}
                        href={validationPdfPageHref(report.sourcePdf, page)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Side {page}
                      </a>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Ingen sidehenvisning</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField
                label="Kildeuddrag"
                value={rule.sourceText}
                onChange={(value) => onRuleChange(rule.ruleKey, { sourceText: value })}
              />
              <TextField
                label="Mulige satser"
                value={rule.possibleRates.join("\n")}
                onChange={(value) =>
                  onRuleChange(rule.ruleKey, {
                    possibleRates: value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
              <TextField
                label="Betingelser"
                value={rule.conditions}
                onChange={(value) => onRuleChange(rule.ruleKey, { conditions: value })}
              />
              <TextField
                label="Review-note"
                value={rule.notes}
                onChange={(value) => onRuleChange(rule.ruleKey, { notes: value })}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border bg-card p-4">
        <h4 className="font-medium">Testcases</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="border-b py-2 pr-3">Test</th>
                <th className="border-b py-2 pr-3">Status</th>
                <th className="border-b py-2 pr-3">Forventet</th>
                <th className="border-b py-2 pr-3">Faktisk / note</th>
              </tr>
            </thead>
            <tbody>
              {report.testCases.map((testCase) => (
                <tr key={testCase.id}>
                  <td className="border-b py-2 pr-3 align-top">
                    <div className="font-medium">{testCase.label}</div>
                    <div className="text-muted-foreground">{testCase.description}</div>
                  </td>
                  <td className="border-b py-2 pr-3 align-top">{testCase.status}</td>
                  <td className="border-b py-2 pr-3 align-top">{testCase.expected}</td>
                  <td className="border-b py-2 pr-3 align-top">
                    {testCase.actual}
                    {testCase.notes ? (
                      <div className="mt-1 text-muted-foreground">{testCase.notes}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
        <Field label="Valideret af">
          <Input
            value={validatedBy}
            onChange={(event) => onValidatedByChange(event.target.value)}
          />
        </Field>
        <TextField
          label={`Valideringsnote (${validationDate})`}
          value={validationNote}
          onChange={onValidationNoteChange}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-muted-foreground">{validationMessage}</span>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onReset}>
            Nulstil validering
          </Button>
          <Button variant="outline" onClick={onSave}>
            Gem review
          </Button>
          <Button onClick={onValidate} disabled={blockers.length > 0}>
            Markér overenskomst som valideret
          </Button>
        </div>
      </div>
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function validationPdfPageHref(sourcePdf: string, page: number) {
  const pdfUrl = sourcePdf.startsWith("/") ? sourcePdf : `/overenskomster/${sourcePdf}`;
  return `${publicAgreementPdfHref(pdfUrl)}#page=${page}`;
}

function parsePageInput(value: string) {
  const pages = value
    .split(",")
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) return [];
      const range = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const from = Number(range[1]);
        const to = Number(range[2]);
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
      const page = Number(trimmed);
      return Number.isFinite(page) && page > 0 ? [page] : [];
    })
    .filter((page) => Number.isInteger(page) && page > 0);

  return [...new Set(pages)];
}
