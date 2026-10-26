import { StockBucketName, UserRole } from '../types/domain';

export const BUCKET_LABELS: Record<StockBucketName, { en: string; am: string }> = {
  Available: { en: 'Available', am: 'ለሽያጭ ዝግጁ (Available)' },
  Reserved: { en: 'Reserved', am: 'ለትዕዛዝ የተያዘ (Reserved)' },
  'On the Van': { en: 'On the Van', am: 'በመኪና ላይ (On the Van)' },
  'Pending Return': { en: 'Pending Return', am: 'ተመላሽ በመጠባበቅ ላይ (Pending Return)' },
  Damaged: { en: 'Damaged', am: 'የተበላሸ (Damaged)' },
};

export const ROLE_LABELS: Record<UserRole, { en: string; am: string; shortEn: string }> = {
  'Sales Officer (Bole Office)': {
    en: 'Sales Officer (Bole Office)',
    am: 'የሽያጭ ባለሙያ (ቦሌ ቢሮ)',
    shortEn: 'Sales (Bole)',
  },
  'Accountant / Finance': {
    en: 'Accountant / Finance',
    am: 'ሂሳብ ክፍል (Accountant)',
    shortEn: 'Accountant',
  },
  'Storekeeper (Kality Warehouse)': {
    en: 'Storekeeper (Kality Warehouse)',
    am: 'ንብረት ክፍል (ቃሊቲ መጋዘን)',
    shortEn: 'Storekeeper (Kality)',
  },
  'Delivery Driver (Mobile Phone View)': {
    en: 'Delivery Driver (Mobile Phone View)',
    am: 'የስርጭት ሾፌር (ሞባይል)',
    shortEn: 'Driver (Mobile)',
  },
  'Owner / Manager': {
    en: 'Owner / Manager',
    am: 'ዋና ሥራ አስኪያጅ (Manager)',
    shortEn: 'Owner / Manager',
  },
};

export const VOUCHER_TITLES: Record<'GRN' | 'SIV' | 'SRN' | 'ADJ', { en: string; am: string }> = {
  GRN: {
    en: 'Goods Receiving Note (GRN)',
    am: 'GRN - የዕቃ መረከቢያ ሰነድ',
  },
  SIV: {
    en: 'Store Issue Voucher (SIV)',
    am: 'SIV - የዕቃ ማውጫ ሰነድ',
  },
  SRN: {
    en: 'Store Return Note (SRN)',
    am: 'SRN - የተመላሽ ዕቃ መረከቢያ ሰነድ',
  },
  ADJ: {
    en: 'Stock Write-Off / Adjustment Voucher (ADJ)',
    am: 'ADJ - የተበላሸ ዕቃ ማስተካከያ ሰነድ',
  },
};

export const UI_TEXT = {
  appName: {
    en: 'EthioStock & Dispatch Hub',
    am: 'ኢትዮ-ስቶክ እና ስርጭት ማዕከል',
  },
  appSubtitle: {
    en: 'Bole Sales Office · Kality Central Warehouse (Addis Ababa)',
    am: 'ቦሌ ሽያጭ ቢሮ · ቃሊቲ ዋና መጋዘን (አዲስ አበባ)',
  },
  nav: {
    screen1: { en: '1. Command Center', am: '1. አጠቃላይ እይታ' },
    screen2: { en: '2. Warehouse & GRN', am: '2. መጋዘን እና GRN' },
    screen3: { en: '3. B2B Shops & OMS', am: '3. ሱቆች እና ትዕዛዝ' },
    screen4: { en: '4. Packing & SIV', am: '4. ማሸጊያ እና SIV' },
    screen5: { en: '5. Driver Mobile TMS', am: '5. የሾፌር ሞባይል' },
    screen6: { en: '6. Returns (SRN) & 5PM Settlement', am: '6. ተመላሽ (SRN) እና ሂሳብ' },
  },
  deliveredAndSold: {
    en: 'Delivered & Sold',
    am: 'የደረሰ እና የተሸጠ (Delivered & Sold)',
  },
  apiSettings: {
    en: 'API & Integration Setup',
    am: 'የኤፒአይ እና ካርታ ማስተካከያ',
  },
  resetDemo: {
    en: 'Reset Demo Data',
    am: 'ዳታ እንደገና አስጀምር',
  },
};
