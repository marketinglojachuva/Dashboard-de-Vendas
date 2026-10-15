export type SalesPeriod = 'current' | 'previous'

export interface SaleRow {
  adId: string
  title: string
  unitsSold: number
  price: number
  revenue: number
  saleDate?: string
  status?: string
  salesNumber?: string
  sku?: string
  adType?: string
  isSponsored?: boolean
  productRevenue?: number
  salesFee?: number
  shippingFee?: number
  state?: string
  deliveryType?: string
  source: Record<string, unknown>
}

export interface AggregatedSale {
  adId: string
  title: string
  currentUnits: number
  previousUnits: number
  currentRevenue: number
  previousRevenue: number
  variation: number | null
}

export interface SalesSummary {
  totalUnits: number
  totalRevenue: number
  totalAds: number
  totalRows: number
}

export interface SalesTrendPoint {
  date: string
  label: string
  units: number
  revenue: number
  orders: number
}

export interface SalesRankingItem {
  name: string
  units: number
  revenue: number
}

export interface SalesDistributionItem {
  name: string
  value: number
}
