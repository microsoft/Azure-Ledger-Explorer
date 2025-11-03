/**
 * Ledger domain localStorage management
 * 
 * Tracks which ledger was imported (MST, ACL, or Manual) 
 * and displays in Configuration page UI
 */

const LEDGER_DOMAIN_KEY = 'ledger_domain';
const LEDGER_IMPORT_TYPE_KEY = 'ledger_import_type';
const LEDGER_IMPORT_DATE_KEY = 'ledger_import_date';

export type LedgerImportType = 'MST' | 'ACL' | 'Manual';

export interface LedgerDomainInfo {
  domain: string | null;
  type: LedgerImportType | null;
  importedAt: string | null;
}

export const setLedgerDomain = (
  domain: string, 
  type: LedgerImportType = 'MST'
): void => {
  localStorage.setItem(LEDGER_DOMAIN_KEY, domain);
  localStorage.setItem(LEDGER_IMPORT_TYPE_KEY, type);
  localStorage.setItem(LEDGER_IMPORT_DATE_KEY, new Date().toISOString());
};

export const getLedgerDomain = (): LedgerDomainInfo => ({
  domain: localStorage.getItem(LEDGER_DOMAIN_KEY),
  type: localStorage.getItem(LEDGER_IMPORT_TYPE_KEY) as LedgerImportType | null,
  importedAt: localStorage.getItem(LEDGER_IMPORT_DATE_KEY),
});

export const clearLedgerDomain = (): void => {
  localStorage.removeItem(LEDGER_DOMAIN_KEY);
  localStorage.removeItem(LEDGER_IMPORT_TYPE_KEY);
  localStorage.removeItem(LEDGER_IMPORT_DATE_KEY);
};
