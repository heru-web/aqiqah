export interface StageData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  type: "OPEN" | "WON" | "LOST";
  position: number;
}

export interface DealCardData {
  id: string;
  title: string;
  value: string;
  source: string | null;
  productInterest: string | null;
  stageId: string;
  stageType: "OPEN" | "WON" | "LOST";
  personId: string | null;
  personName: string | null;
  personPhone: string | null;
  personWhatsapp: string | null;
  organizationId: string | null;
  organizationName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  lostReason?: string | null;
  notes: string | null;
}

export interface PersonOption {
  id: string;
  name: string;
  organizationName?: string | null;
}

export interface OrganizationOption {
  id: string;
  name: string;
}

export interface UserOption {
  id: string;
  name: string;
}
