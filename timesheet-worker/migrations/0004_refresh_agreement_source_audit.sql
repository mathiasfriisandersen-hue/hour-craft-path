-- Refreshes catalog identity/status from the 2026-08-13 source audit.
--
-- This is deliberately metadata-only. It creates no agreement version, source,
-- rule or rate period, and cannot make a collective agreement active.

PRAGMA foreign_keys = ON;

UPDATE agreements
SET
  exact_title = CASE catalog_key
    WHEN 'gulvoverenskomsten' THEN 'Gulvoverenskomsten 2025-2028'
    WHEN 'asfaltoverenskomsten' THEN 'Asfaltoverenskomsten 2025-2028'
    WHEN 'isoleringsoverenskomsten' THEN 'Isoleringsoverenskomsten 2025-2028'
    WHEN 'glasoverenskomsten' THEN 'Glasoverenskomsten 2025-2028'
    WHEN 'bygge-anlaeg-dansk-haandvaerk-3f' THEN 'Bygge- og Anlægsoverenskomst 2026-2029'
    WHEN 'el-di-def' THEN 'El-overenskomsten 2025-2028'
    WHEN 'metal-blik-roer' THEN 'Metal- og Blik- og Røroverenskomsten 2025-2028'
    WHEN 'vvs-tekniq-blikroer-metal' THEN 'VVS-overenskomsterne 2025-2028'
    WHEN 'maler-di-malerforbundet' THEN 'Maleroverenskomsten 2025-2028'
    WHEN 'maler-danske-malermestre' THEN 'Overenskomsten mellem Danske Malermestre og Malerforbundet'
    WHEN 'jord-beton-kbh-frederiksberg-amager' THEN 'Jord- og Betonoverenskomsten 2025-2028'
    WHEN 'murerarbejdsmand-kbh-frederiksberg' THEN 'Murerarbejdsmandsoverenskomsten 2025-2028'
    WHEN 'industrioverenskomsten-di-byggeri' THEN 'Industrioverenskomsten 2025-2028'
    WHEN 'trae-moebeloverenskomsten' THEN 'Træ- og Møbeloverenskomsten 2025-2028'
    WHEN 'industri-trae-moebeloverenskomsten' THEN 'Industri-, Træ- og Møbeloverenskomsten 2025-2028'
    WHEN 'emballageindustriens-overenskomst' THEN 'Emballageoverenskomsten 2025-2028'
    WHEN 'foedevareindustrielle-overenskomst' THEN 'Den Fødevareindustrielle Overenskomst 2025-2028'
    WHEN 'slagteoverenskomsten' THEN 'Slagteoverenskomsten 2025-2028'
    WHEN 'mejeribranchens-faellesoverenskomst' THEN 'Mejeribranchens Fællesoverenskomst 2025-2028'
    WHEN 'industri-vvs-overenskomsten' THEN 'Industri- og VVS-overenskomsten 2025-2028'
    WHEN 'dsm-industriomraadet' THEN 'DSM Industrioverenskomst 2025-2028'
    WHEN 'faglaerteoverenskomsten-betinget' THEN 'Faglærteoverenskomsten 2025-2028'
    ELSE exact_title
  END,
  agreement_parties = CASE catalog_key
    WHEN 'gulvoverenskomsten' THEN 'DI Overenskomst III og 3F Fagligt Fælles Forbund Byggegruppen'
    WHEN 'asfaltoverenskomsten' THEN 'Asfaltindustriens Arbejdsgiverforening og 3F Fagligt Fælles Forbund'
    WHEN 'isoleringsoverenskomsten' THEN 'DI Overenskomst I og 3F Fagligt Fælles Forbund'
    WHEN 'glasoverenskomsten' THEN 'Glarmesterlauget i Danmark og 3F Fagligt Fælles Forbund'
    WHEN 'bygge-anlaeg-dansk-haandvaerk-3f' THEN 'Dansk Håndværk og 3F Fagligt Fælles Forbund'
    WHEN 'el-di-def' THEN 'DI Overenskomst III og Dansk El-Forbund'
    WHEN 'metal-blik-roer' THEN 'DI Overenskomst III, Dansk Metal og Blik- og Rørarbejderforbundet i Danmark'
    WHEN 'vvs-tekniq-blikroer-metal' THEN 'TEKNIQ Arbejdsgiverne, Blik- og Rørarbejderforbundet og Dansk Metal'
    WHEN 'maler-di-malerforbundet' THEN 'DI Overenskomst III og Malerforbundet i Danmark'
    WHEN 'maler-danske-malermestre' THEN 'Danske Malermestre og Malerforbundet'
    WHEN 'maler-kooperationen' THEN 'Kooperationen og Malerforbundet'
    WHEN 'jord-beton-kbh-frederiksberg-amager' THEN 'DI Overenskomst III og Bygge-, Jord- og Miljøarbejdernes Fagforening'
    WHEN 'murerarbejdsmand-kbh-frederiksberg' THEN 'DI Overenskomst III og Bygge-, Jord- og Miljøarbejdernes Fagforening'
    WHEN 'industrioverenskomsten-di-byggeri' THEN 'DI Overenskomst III og 3F Fagligt Fælles Forbund Byggegruppen'
    WHEN 'trae-moebeloverenskomsten' THEN 'DI Overenskomst I for Træ- og Møbelindustrien og 3F Fagligt Fælles Forbund'
    WHEN 'industri-trae-moebeloverenskomsten' THEN 'DI Overenskomst III og 3F Fagligt Fælles Forbund Industrigruppen'
    WHEN 'emballageindustriens-overenskomst' THEN 'DI Overenskomst I for Emballageindustrien og Plastindustrien i Danmark, 3F Industri (Emballage) og HK Privat'
    WHEN 'foedevareindustrielle-overenskomst' THEN 'DI Overenskomst I og Fødevareforbundet NNF'
    WHEN 'slagteoverenskomsten' THEN 'Fødevareforbundet NNF og DI Overenskomst I'
    WHEN 'mejeribranchens-faellesoverenskomst' THEN 'Mejeribrugets Arbejdsgiverforening og overenskomstens arbejdstagerorganisationer, herunder Fødevareforbundet NNF'
    WHEN 'industri-vvs-overenskomsten' THEN 'TEKNIQ Arbejdsgiverne, Dansk Metal, 3F Industri og Blik- og Rørarbejderforbundet'
    WHEN 'dsm-industriomraadet' THEN 'Danske Slagtermestre og Fødevareforbundet NNF'
    WHEN 'faglaerteoverenskomsten-betinget' THEN 'DI Overenskomst II, Dansk Metal og Dansk El-Forbund; tiltrådt af 3F Industri (TIB) og Malerforbundet'
    ELSE agreement_parties
  END,
  catalog_status = CASE catalog_key
    WHEN 'el-di-def' THEN 'manual_review_required'
    WHEN 'maler-danske-malermestre' THEN 'manual_review_required'
    WHEN 'maler-kooperationen' THEN 'manual_review_required'
    WHEN 'maler-di-malerforbundet' THEN 'source_conflict'
    WHEN 'murerarbejdsmand-kbh-frederiksberg' THEN 'source_conflict'
    WHEN 'gulv-bjmf-protokol' THEN 'out_of_scope'
    WHEN 'industriens-organisationsaftaler' THEN 'out_of_scope'
    WHEN 'faglaerteoverenskomsten-betinget' THEN 'out_of_scope'
    ELSE 'verified_not_implemented'
  END;
