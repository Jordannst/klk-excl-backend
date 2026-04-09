export const invoiceDateModes = ['enabled', 'blank-column', 'hidden-column'] as const
export const prismaInvoiceDateModes = ['enabled', 'blank_column', 'hidden_column'] as const

export type InvoiceDateMode = (typeof invoiceDateModes)[number]
export type PrismaInvoiceDateMode = (typeof prismaInvoiceDateModes)[number]

const defaultInvoiceDateMode: InvoiceDateMode = 'enabled'
const invoiceDateModeSet = new Set<InvoiceDateMode>(invoiceDateModes)
const prismaInvoiceDateModeSet = new Set<PrismaInvoiceDateMode>(prismaInvoiceDateModes)
const transactionDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

export const invoiceDateModeToPrisma = {
  enabled: 'enabled',
  'blank-column': 'blank_column',
  'hidden-column': 'hidden_column',
} as const satisfies Record<InvoiceDateMode, PrismaInvoiceDateMode>

export const prismaInvoiceDateModeToApi = {
  enabled: 'enabled',
  blank_column: 'blank-column',
  hidden_column: 'hidden-column',
} as const satisfies Record<PrismaInvoiceDateMode, InvoiceDateMode>

export function isInvoiceDateMode(value: unknown): value is InvoiceDateMode {
  return typeof value === 'string' && invoiceDateModeSet.has(value as InvoiceDateMode)
}

export function isPrismaInvoiceDateMode(value: unknown): value is PrismaInvoiceDateMode {
  return typeof value === 'string' && prismaInvoiceDateModeSet.has(value as PrismaInvoiceDateMode)
}

export function normalizeInvoiceDateMode(value: unknown): InvoiceDateMode {
  if (value === undefined || value === null || value === '') return defaultInvoiceDateMode

  if (!isInvoiceDateMode(value)) {
    throw new Error('Invalid invoice date mode')
  }

  return value
}

export function toPrismaInvoiceDateMode(value: InvoiceDateMode): PrismaInvoiceDateMode {
  return invoiceDateModeToPrisma[value]
}

export function fromPrismaInvoiceDateMode(value: PrismaInvoiceDateMode): InvoiceDateMode {
  return prismaInvoiceDateModeToApi[value]
}

export function normalizePrismaInvoiceDateMode(value: unknown): PrismaInvoiceDateMode {
  if (value === undefined || value === null || value === '') {
    return toPrismaInvoiceDateMode(defaultInvoiceDateMode)
  }

  if (isPrismaInvoiceDateMode(value)) {
    return value
  }

  if (isInvoiceDateMode(value)) {
    return toPrismaInvoiceDateMode(value)
  }

  throw new Error('Invalid invoice date mode')
}

export function normalizeTransactionDate(
  value: unknown,
  dateMode: InvoiceDateMode
): Date | null {
  if (value === undefined || value === null || value === '') {
    if (dateMode === defaultInvoiceDateMode) {
      throw new Error('tanggal is required when date mode is enabled')
    }

    return null
  }

  if (typeof value !== 'string') {
    throw new Error('tanggal must be a valid date-only string in YYYY-MM-DD format')
  }

  const match = value.match(transactionDatePattern)

  if (!match) {
    throw new Error('tanggal must be a valid date-only string in YYYY-MM-DD format')
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (year >= 0 && year <= 99) {
    parsed.setUTCFullYear(year)
  }

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('tanggal must be a real calendar date in YYYY-MM-DD format')
  }

  return parsed
}
