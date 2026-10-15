import * as XLSX from 'xlsx'
import type { AggregatedSale, SaleRow, SalesDistributionItem, SalesRankingItem, SalesSummary, SalesTrendPoint } from '@/types/sales'

const aliases = {
  adId: ['# de anúncio', '# de anuncio', 'número do anúncio', 'numero do anuncio', 'nº do anúncio', 'nº do anuncio', 'n° do anúncio', 'n° do anuncio', 'id do anúncio', 'id do anuncio', 'anúncio', 'anuncio', 'mlb', 'mlb id', 'item id', 'id do item', 'listing id', 'código do anúncio', 'codigo do anuncio', 'código mlb', 'codigo mlb'],
  title: ['título do anúncio', 'titulo do anuncio', 'título', 'titulo', 'nome do anúncio', 'nome do anuncio', 'produto', 'producto', 'product', 'title', 'item title'],
  unitsSold: ['unidades vendidas', 'quantidade vendida', 'qtd vendida', 'unidades', 'quantidade', 'quantity', 'vendas', 'sales', 'units sold', 'quantity sold', 'qty'],
  price: ['preço unitário de venda do anúncio (brl)', 'preco unitario de venda do anuncio brl', 'preço unitário', 'preco unitario', 'preço', 'preco', 'price', 'valor unitário', 'valor unitario', 'unit price', 'preço de venda', 'preco de venda'],
  revenue: ['total (brl)', 'total brl', 'total da venda', 'faturamento total', 'receita total', 'faturamento', 'receita', 'valor total', 'valor da venda', 'valor vendido', 'total', 'revenue', 'total sales', 'gross sales'],
  productRevenue: ['receita por produtos (brl)', 'receita por produtos brl', 'receita por produto'],
  salesFee: ['tarifa de venda e impostos (brl)', 'tarifa de venda e impostos brl', 'tarifa de venda', 'taxa de venda'],
  shippingFee: ['tarifas de envio (brl)', 'tarifas de envio brl', 'tarifa de envio'],
  saleDate: ['data de venda', 'data da venda', 'sale date', 'date'],
  salesNumber: ['n.º de venda', 'n de venda', 'número de venda', 'numero de venda', 'sale id', 'order id'],
  status: ['estado', 'status', 'situação', 'situacao'],
  sku: ['sku', 'código sku', 'codigo sku'],
  adType: ['tipo de anúncio', 'tipo de anuncio', 'ad type'],
  sponsored: ['venda por publicidade', 'venda por publicidade?','publicidade', 'sponsored sale'],
  state: ['estado do comprador', 'uf', 'state'],
  deliveryType: ['forma de entrega', 'delivery type', 'shipping method'],
} as const

function normalizeText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findColumn(headers: string[], candidates: readonly string[]): string | undefined {
  const normalizedHeaders = headers.map((header) => ({ original: header, normalized: normalizeText(header) }))
  const normalizedCandidates = candidates.map(normalizeText)
  return normalizedHeaders.find(({ normalized }) => normalizedCandidates.includes(normalized))?.original
    ?? normalizedHeaders.find(({ normalized }) => normalizedCandidates.some((candidate) => normalized.includes(candidate)))?.original
}

function findHeaderRow(matrix: unknown[][]): number {
  let bestIndex = 0
  let bestScore = 0
  matrix.slice(0, 40).forEach((row, index) => {
    const headers = row.map((cell) => String(cell ?? ''))
    const score = [aliases.adId, aliases.title, aliases.unitsSold, aliases.revenue].filter((group) => Boolean(findColumn(headers, group))).length
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })
  return bestIndex
}

export function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!raw) return 0
  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  const normalized = hasComma && hasDot
    ? (raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, ''))
    : hasComma ? raw.replace(',', '.') : raw
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function getString(row: Record<string, unknown>, column?: string): string {
  return column ? String(row[column] ?? '').trim() : ''
}

export function parseSpreadsheetRows(rows: Record<string, unknown>[]): SaleRow[] {
  if (!rows.length) return []
  const headers = Object.keys(rows[0])
  const columns = {
    adId: findColumn(headers, aliases.adId), title: findColumn(headers, aliases.title), unitsSold: findColumn(headers, aliases.unitsSold), price: findColumn(headers, aliases.price), revenue: findColumn(headers, aliases.revenue), productRevenue: findColumn(headers, aliases.productRevenue), salesFee: findColumn(headers, aliases.salesFee), shippingFee: findColumn(headers, aliases.shippingFee), saleDate: findColumn(headers, aliases.saleDate), salesNumber: findColumn(headers, aliases.salesNumber), status: findColumn(headers, aliases.status), sku: findColumn(headers, aliases.sku), adType: findColumn(headers, aliases.adType), sponsored: findColumn(headers, aliases.sponsored), state: findColumn(headers, aliases.state), deliveryType: findColumn(headers, aliases.deliveryType),
  }

  if (!columns.adId) throw new Error(`Não encontrei a coluna do anúncio/MLB. Cabeçalhos encontrados: ${headers.slice(0, 15).join(', ')}`)

  return rows.map((row) => {
    const rawAdId = getString(row, columns.adId)
    const unitsSold = columns.unitsSold ? parseNumber(row[columns.unitsSold]) : (rawAdId ? 1 : 0)
    const price = columns.price ? parseNumber(row[columns.price]) : 0
    const productRevenue = columns.productRevenue ? parseNumber(row[columns.productRevenue]) : 0
    const revenueValue = columns.revenue ? parseNumber(row[columns.revenue]) : 0
    const adId = rawAdId || (unitsSold !== 0 || revenueValue !== 0 || productRevenue !== 0 ? 'SEM_ANUNCIO' : '')
    return {
      adId,
      title: getString(row, columns.title) || (rawAdId || 'Pedido agrupado / anúncio não identificado'),
      unitsSold,
      price,
      revenue: revenueValue || productRevenue || price * unitsSold,
      saleDate: getString(row, columns.saleDate),
      status: getString(row, columns.status),
      salesNumber: getString(row, columns.salesNumber),
      sku: getString(row, columns.sku),
      adType: getString(row, columns.adType),
      isSponsored: getString(row, columns.sponsored).toLowerCase() === 'sim',
      productRevenue,
      salesFee: columns.salesFee ? parseNumber(row[columns.salesFee]) : 0,
      shippingFee: columns.shippingFee ? parseNumber(row[columns.shippingFee]) : 0,
      state: getString(row, columns.state) || getString(row, 'Estado_1'),
      deliveryType: getString(row, columns.deliveryType),
      source: row,
    }
  }).filter((row) => row.adId && (row.unitsSold !== 0 || row.revenue !== 0))
}

export async function readSalesFile(file: File): Promise<{ rows: SaleRow[]; rawRows: Record<string, unknown>[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, raw: true })
  const firstSheetName = workbook.SheetNames[0]
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined
  if (!firstSheet) throw new Error('A planilha não possui uma aba válida.')
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '' })
  if (!matrix.length) throw new Error('A primeira aba está vazia.')
  const headerRow = findHeaderRow(matrix)
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '', range: headerRow })
  const rows = parseSpreadsheetRows(rawRows)
  if (!rows.length) throw new Error('Encontrei o cabeçalho, mas nenhuma linha de venda válida foi encontrada.')
  return { rows, rawRows }
}

export function summarizeSales(rows: SaleRow[]): SalesSummary {
  return { totalUnits: rows.reduce((sum, row) => sum + row.unitsSold, 0), totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0), totalAds: new Set(rows.map((row) => row.adId)).size, totalRows: rows.length }
}

export function groupByAd(rows: SaleRow[]): Map<string, SaleRow> {
  return rows.reduce((grouped, row) => {
    const existing = grouped.get(row.adId)
    if (existing) { existing.unitsSold += row.unitsSold; existing.revenue += row.revenue; existing.productRevenue = (existing.productRevenue ?? 0) + (row.productRevenue ?? 0); existing.salesFee = (existing.salesFee ?? 0) + (row.salesFee ?? 0); existing.shippingFee = (existing.shippingFee ?? 0) + (row.shippingFee ?? 0); existing.price = existing.price || row.price } else grouped.set(row.adId, { ...row })
    return grouped
  }, new Map<string, SaleRow>())
}

export function comparePeriods(currentRows: SaleRow[], previousRows: SaleRow[]): AggregatedSale[] {
  const current = groupByAd(currentRows); const previous = groupByAd(previousRows); const ids = new Set([...current.keys(), ...previous.keys()])
  return [...ids].map((adId) => {
    const currentSale = current.get(adId); const previousSale = previous.get(adId); const currentUnits = currentSale?.unitsSold ?? 0; const previousUnits = previousSale?.unitsSold ?? 0
    return { adId, title: currentSale?.title || previousSale?.title || adId, currentUnits, previousUnits, currentRevenue: currentSale?.revenue ?? 0, previousRevenue: previousSale?.revenue ?? 0, variation: previousUnits === 0 ? (currentUnits > 0 ? null : 0) : ((currentUnits - previousUnits) / previousUnits) * 100 }
  }).sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0))
}

const monthNumbers: Record<string, string> = { janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' }

function dateKey(value?: string): string {
  const match = String(value ?? '').toLowerCase().match(/(\d{1,2}) de ([a-zç]+) de (\d{4})/)
  if (match) return `${match[3]}-${monthNumbers[match[2]] ?? '01'}-${match[1].padStart(2, '0')}`
  const parsed = new Date(value ?? '')
  return Number.isNaN(parsed.getTime()) ? String(value ?? 'Sem data') : parsed.toISOString().slice(0, 10)
}

export function buildSalesTrend(rows: SaleRow[]): SalesTrendPoint[] {
  const groups = new Map<string, SalesTrendPoint>()
  rows.forEach((row) => { const key = dateKey(row.saleDate); const item = groups.get(key) ?? { date: key, label: key === 'Sem data' ? key : key.slice(8, 10) + '/' + key.slice(5, 7), units: 0, revenue: 0, orders: 0 }; item.units += row.unitsSold; item.revenue += row.revenue; item.orders += 1; groups.set(key, item) })
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function buildTopAds(rows: SaleRow[], limit = 8): SalesRankingItem[] {
  const groups = new Map<string, SalesRankingItem>()
  rows.forEach((row) => { const item = groups.get(row.adId) ?? { name: row.title || row.adId, units: 0, revenue: 0 }; item.units += row.unitsSold; item.revenue += row.revenue; groups.set(row.adId, item) })
  return [...groups.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function buildDistribution(rows: SaleRow[], field: 'status' | 'adType' | 'deliveryType', limit = 6): SalesDistributionItem[] {
  const groups = new Map<string, number>()
  rows.forEach((row) => { const value = row[field] || 'Não informado'; groups.set(value, (groups.get(value) ?? 0) + 1) })
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1])
  const visible = sorted.slice(0, limit); const remainder = sorted.slice(limit).reduce((sum, item) => sum + item[1], 0)
  return [...visible.map(([name, value]) => ({ name, value })), ...(remainder ? [{ name: 'Outros', value: remainder }] : [])]
}
