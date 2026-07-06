import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, InfoBanner } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRules, saveRule } from "@/lib/timesheet-store";
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
import {
  listAgreementValidationReports,
  saveAgreementValidationReport,
  type AgreementRuleCategory,
  type AgreementValidationReport,
} from "@/lib/agreementValidation";

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
  const [sourcePageInputs, setSourcePageInputs] = useState<Record<string, string>>({});
  const rule = rules.find((item) => item.agreementId === selectedId);
  const agreement = rule ? getCollectiveAgreementById(rule.agreementId) : undefined;

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

    const sourceFields = Object.keys(AGREEMENT_RULE_SOURCE_LABEL) as AgreementRuleSourceKey[];

    const mergedSources = sourceFields.flatMap((field) => {
      const existingSources = rule.sources.filter((source) => source.field === field);
      const existing = existingSources[0];
      const pageInputKey = `${selectedId}:${field}`;
      const draftValue = sourcePageInputs[pageInputKey];

      const pages =
        draftValue !== undefined
          ? parsePageInput(draftValue)
          : existingSources.map((source) => source.page);

      const pdfUrl = existing?.pdfUrl ?? agreement?.pdfUrl ?? "";
      const pdfFileName = existing?.pdfFileName ?? agreement?.pdfFileName ?? "";

      if (pages.length === 0 || !pdfUrl.trim()) {
        return [];
      }

      return pages.map((page) => ({
        field,
        page,
        pdfUrl: pdfUrl.trim(),
        pdfFileName: pdfFileName.trim() || undefined,
      }));
    });

    const ruleToSave = {
      ...rule,
      sources: mergedSources,
    };

    saveRule(ruleToSave);
    syncValidationFromRuleSources(ruleToSave);
    setRules(listRules());
    setSourcePageInputs({});
    setMessage("Regelgrundlaget er gemt i denne browser.");
    window.setTimeout(() => setMessage(""), 3000);
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
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
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
                          placeholder="/overenskomster/filnavn.pdf"
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
                Gem regler
              </Button>
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

const SOURCE_FIELD_VALIDATION_RULES: Record<AgreementRuleSourceKey, AgreementRuleCategory[]> = {
  normalDayHours: ["normal_daily_working_time"],
  normalWeekHours: ["normal_weekly_working_time"],
  overtimeRule: ["overtime", "outside_normal_time"],
  saturdayRule: ["saturday_allowance"],
  sundayRule: ["sunday_allowance", "public_holiday"],
  eveningRule: ["evening_allowance", "staggered_time"],
  nightRule: ["night_allowance"],
  shiftRule: ["shift_work"],
  specialRule: ["special_allowances", "local_agreements", "breaks"],
};

const VALIDATION_RULE_LABELS: Record<AgreementRuleCategory, string> = {
  normal_daily_working_time: "Normal daglig arbejdstid",
  normal_weekly_working_time: "Normal ugentlig arbejdstid",
  overtime: "Overarbejde",
  saturday_allowance: "Lørdagstillæg",
  sunday_allowance: "Søndagstillæg",
  public_holiday: "Helligdage / søgnehelligdage",
  evening_allowance: "Aftentillæg",
  night_allowance: "Nattillæg",
  staggered_time: "Forskudt tid",
  shift_work: "Skiftehold / holddrift",
  special_allowances: "Særlige tillæg",
  local_agreements: "Lokalaftaler",
  breaks: "Pauser",
  outside_normal_time: "Arbejde uden for normal tid",
};

function createValidationReportFromRuleSources(
  rule: AgreementRule,
): AgreementValidationReport | undefined {
  const agreement = getCollectiveAgreementById(rule.agreementId);
  if (!agreement) return undefined;

  const rules = Object.entries(SOURCE_FIELD_VALIDATION_RULES).flatMap(([field, ruleKeys]) => {
    const pages = [
      ...new Set(
        rule.sources
          .filter((source) => source.field === field)
          .map((source) => source.page)
          .filter((page) => Number.isInteger(page) && page > 0),
      ),
    ].sort((a, b) => a - b);

    if (!pages.length) return [];

    return ruleKeys.map((ruleKey) => ({
      ruleKey,
      label: VALIDATION_RULE_LABELS[ruleKey],
      required: !["special_allowances", "local_agreements"].includes(ruleKey),
      calculationType: "manual" as const,
      rate: null,
      unit: null,
      conditions: "Valideres manuelt ud fra kildehenvisningen i regelgrundlaget.",
      pdfPages: pages,
      sourceText: "Kildehenvisning er angivet i regelgrundlagets PDF-sidefelt.",
      possibleRates: [],
      confidence: "medium" as const,
      reviewStatus: "approved" as const,
      notes: "Godkendt via kildehenvisning i regelgrundlaget.",
    }));
  });

  if (!rules.length) return undefined;

  return {
    agreementSlug: agreement.id,
    agreementName: agreement.name,
    sourceAuditVersion: "pdf-references-v1",
    status: "validated_for_calculation",
    validatedForCalculation: true,
    sourcePdf: agreement.pdfFileName ?? agreement.pdfUrl ?? "",
    extractedAt: new Date().toISOString().slice(0, 10),
    validatedAt: new Date().toISOString().slice(0, 10),
    validatedBy: "Admin",
    validationNote: "Valideret via gemte kildehenvisninger i regelgrundlaget.",
    rules,
    testCases: [],
  };
}

function syncValidationFromRuleSources(rule: AgreementRule) {
  const sourceReport = createValidationReportFromRuleSources(rule);
  if (!sourceReport) return;

  const existingReport = listAgreementValidationReports().find(
    (item) => item.agreementSlug === rule.agreementId,
  );
  const existingRulesByKey = new Map(
    (existingReport?.rules ?? []).map((validationRule) => [validationRule.ruleKey, validationRule]),
  );
  saveAgreementValidationReport({
    ...sourceReport,
    extractedAt: existingReport?.extractedAt || sourceReport.extractedAt,
    rules: sourceReport.rules.map((validationRule) => {
      const existingRule = existingRulesByKey.get(validationRule.ruleKey);
      return {
        ...validationRule,
        calculationType: existingRule?.calculationType ?? validationRule.calculationType,
        rate: existingRule?.rate ?? validationRule.rate,
        unit: existingRule?.unit ?? validationRule.unit,
        conditions: existingRule?.conditions.trim()
          ? existingRule.conditions
          : validationRule.conditions,
        sourceText: existingRule?.sourceText.trim()
          ? existingRule.sourceText
          : validationRule.sourceText,
        possibleRates: existingRule?.possibleRates.length
          ? existingRule.possibleRates
          : validationRule.possibleRates,
        confidence: existingRule?.confidence ?? validationRule.confidence,
        reviewStatus: "approved",
        notes: "Godkendt via kildehenvisning i regelgrundlaget.",
      };
    }),
    testCases: [],
  });
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
