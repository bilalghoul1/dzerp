export type BusinessPartnerKind = "CUSTOMER" | "SUPPLIER";
export type BusinessPartnerType = "COMPANY" | "INDIVIDUAL";

export type BusinessPartnerRow = {
  id: string;
  code: string;
  type: BusinessPartnerType;
  name: string;
  nameAr: string | null;
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  commercialName: string | null;
  legalForm: string | null;
  activity: string | null;
  sector: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  rc: string | null;
  nis: string | null;
  ai: string | null;
  vatNumber: string | null;
  address: string | null;
  wilaya: string | null;
  commune: string | null;
  postalCode: string | null;
  paymentTerms: string | null;
  creditLimit: string;
  balance: string;
  notes: string | null;
  isActive: boolean;
  deletedAt: Date | null;
};

export function normalizeBusinessPartner(row: {
  id: string;
  code: string;
  type: BusinessPartnerType;
  name: string;
  nameAr: string | null;
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  commercialName: string | null;
  legalForm: string | null;
  activity: string | null;
  sector: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  rc: string | null;
  nis: string | null;
  ai: string | null;
  vatNumber: string | null;
  address: string | null;
  wilaya: string | null;
  commune: string | null;
  postalCode: string | null;
  paymentTerms: string | null;
  creditLimit: { toString: () => string };
  balance: { toString: () => string };
  notes: string | null;
  isActive: boolean;
  deletedAt: Date | null;
}): BusinessPartnerRow {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    name: row.name,
    nameAr: row.nameAr,
    firstName: row.firstName,
    lastName: row.lastName,
    legalName: row.legalName,
    commercialName: row.commercialName,
    legalForm: row.legalForm,
    activity: row.activity,
    sector: row.sector,
    email: row.email,
    phone: row.phone,
    taxId: row.taxId,
    rc: row.rc,
    nis: row.nis,
    ai: row.ai,
    vatNumber: row.vatNumber,
    address: row.address,
    wilaya: row.wilaya,
    commune: row.commune,
    postalCode: row.postalCode,
    paymentTerms: row.paymentTerms,
    creditLimit: row.creditLimit.toString(),
    balance: row.balance.toString(),
    notes: row.notes,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
  };
}
