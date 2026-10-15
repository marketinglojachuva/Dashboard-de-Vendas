import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, ChevronRight, CircleAlert, Clock3, FileSpreadsheet, History, Package, Search, ShoppingBag, TrendingDown, TrendingUp, Upload, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import ExcelImportDialog from '@/components/ExcelImportDialog'
import ImportHistoryPanel from '@/components/ImportHistoryPanel'
import SalesCharts from '@/components/SalesCharts'
import useImportHistory, { type ImportedData } from '@/hooks/useImportHistory'
import { comparePeriods } from '@/utils/sales'
import type { AggregatedSale, SalesPeriod } from '@/types/sales'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const compactCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

function VariationBadge({ value, label = 'vs. período anterior' }: { value: number | null; label?: string }) {
  if (value === null) return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">Sem base de comparação</span>
  const isPositive = value > 0
  const isNegative = value < 0
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${isPositive ? 'bg-emerald-50 text-emerald-700' : isNegative ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
    {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : isNegative ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
    {value > 0 ? '+' : ''}{value.toFixed(1).replace('.', ',')}% <span className="hidden font-medium opacity-70 sm:inline">{label}</span>
  </span>
}

function MetricCard({ label, value, description, variation, icon: Icon, iconTone }: { label: string; value: string; description: string; variation?: number | null; icon: typeof TrendingUp; iconTone: string }) {
  return <article className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-3 text-[1.75rem] font-extrabold leading-none tracking-tight text-slate-950">{value}</p></div><span className={`rounded-xl p-3 ${iconTone}`}><Icon className="h-5 w-5" /></span></div>
    <div className="mt-5 flex min-h-5 items-center gap-2"><p className="text-xs text-slate-500">{description}</p>{variation !== undefined ? <VariationBadge value={variation} /> : null}</div>
  </article>
}

function PeriodCard({ label, data, onClick }: { label: string; data: ImportedData | null; onClick: () => void }) {
  return <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${data ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>{data ? <CheckCircle2 className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</span>
    <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</span><span className="mt-1 block truncate text-sm font-bold text-slate-800">{data?.filename ?? 'Importar planilha'}</span></span>
    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-500" />
  </button>
}

function TableVariation({ value }: { value: number | null }) {
  if (value === null) return <span className="font-semibold text-blue-600">Novo</span>
  return <span className={`inline-flex items-center justify-end gap-1 font-bold ${value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-slate-500'}`}>{value > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : value < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}{value > 0 ? '+' : ''}{value.toFixed(1).replace('.', ',')}%</span>
}

export default function Home() {
  const { imports, error: historyError, isRemoteEnabled, loading: historyLoading } = useImportHistory()
  const [currentImport, setCurrentImport] = useState<ImportedData | null>(null)
  const [previousImport, setPreviousImport] = useState<ImportedData | null>(null)
  const [dialogPeriod, setDialogPeriod] = useState<SalesPeriod | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'down'>('all')

  useEffect(() => {
    const selectedId = new URLSearchParams(window.location.search).get('importId')
    const selectedImport = selectedId ? imports.find((item) => item.id === selectedId) : undefined
    if (selectedImport) {
      if (selectedImport.period === 'current') setCurrentImport(selectedImport)
      else setPreviousImport(selectedImport)
    } else {
      if (!currentImport) setCurrentImport(imports.find((item) => item.period === 'current') ?? null)
      if (!previousImport) setPreviousImport(imports.find((item) => item.period === 'previous') ?? null)
    }
  }, [imports, currentImport, previousImport])

  const comparison = useMemo(() => comparePeriods(currentImport?.data ?? [], previousImport?.data ?? []), [currentImport, previousImport])
  const filteredRows = useMemo(() => comparison.filter((row) => {
    const matchesQuery = `${row.title} ${row.adId}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (filter === 'all' || (row.variation !== null && row.variation < 0))
  }), [comparison, filter, query])
  const currentSummary = currentImport?.summary
  const previousSummary = previousImport?.summary
  const totalVariation = previousSummary?.totalUnits ? ((currentSummary?.totalUnits ?? 0) - previousSummary.totalUnits) / previousSummary.totalUnits * 100 : null
  const revenueVariation = previousSummary?.totalRevenue ? ((currentSummary?.totalRevenue ?? 0) - previousSummary.totalRevenue) / previousSummary.totalRevenue * 100 : null
  const ticketAverage = currentSummary?.totalUnits ? (currentSummary.totalRevenue / currentSummary.totalUnits) : 0
  const drops = comparison.filter((row) => row.variation !== null && row.variation < 0)

  const handleImportSuccess = (data: ImportedData) => {
    if (data.period === 'current') setCurrentImport(data)
    else setPreviousImport(data)
    toast.success(`${data.summary.totalAds} anúncios prontos para análise.`)
  }

  const handleHistorySelect = (data: ImportedData) => {
    if (data.period === 'current') setCurrentImport(data)
    else setPreviousImport(data)
    toast.success(`${data.filename} carregada no período ${data.period === 'current' ? 'atual' : 'anterior'}.`)
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-8">
      <a href="/" className="flex items-center gap-3"><span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe600] text-slate-950 shadow-sm"><ShoppingBag className="h-5 w-5" /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600" /></span><span><span className="block text-[17px] font-extrabold tracking-tight text-slate-950">Mercado<span className="text-blue-600">Pulse</span></span><span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">Inteligência de vendas</span></span></a>
      <div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 md:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Dados atualizados localmente</div><a href="/historico" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"><History className="h-4 w-4" /> <span className="hidden sm:inline">Histórico</span></a></div>
    </div></header>

    <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8 lg:py-10">
      <section className="mb-8 flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600"><BarChart3 className="h-4 w-4" /> Painel de performance</div><h1 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-[2.35rem]">Visão geral de vendas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Acompanhe seu desempenho no Mercado Livre e identifique os anúncios que merecem atenção.</p></div><div className="flex w-full gap-3 xl:max-w-[500px]"><PeriodCard label="Semana atual" data={currentImport} onClick={() => setDialogPeriod('current')} /><PeriodCard label="Período anterior" data={previousImport} onClick={() => setDialogPeriod('previous')} /></div></section>

      {historyError ? <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{historyError}</span></div> : null}
      {!currentImport && !previousImport ? <div className="mb-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><FileSpreadsheet className="h-6 w-6" /></div><h2 className="mt-4 text-lg font-bold text-slate-900">Importe seus dados para começar</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Carregue a Semana Atual e o Período Anterior para visualizar uma comparação completa de performance.</p></div> : null}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Faturamento total" value={compactCurrency.format(currentSummary?.totalRevenue ?? 0)} description="Receita bruta da semana" variation={revenueVariation} icon={Wallet} iconTone="bg-blue-50 text-blue-600" /><MetricCard label="Unidades vendidas" value={integer.format(currentSummary?.totalUnits ?? 0)} description="Volume de vendas" variation={totalVariation} icon={Package} iconTone="bg-amber-50 text-amber-700" /><MetricCard label="Ticket médio" value={currency.format(ticketAverage)} description="Receita por unidade" icon={TrendingUp} iconTone="bg-emerald-50 text-emerald-600" /><MetricCard label="Produtos em queda" value={integer.format(drops.length)} description="Prioridade para revisão" icon={TrendingDown} iconTone="bg-red-50 text-red-600" /></section>

      <SalesCharts rows={currentImport?.data ?? []} />

      <div className="mb-8"><ImportHistoryPanel imports={imports} loading={historyLoading} remoteEnabled={isRemoteEnabled} onSelect={handleHistorySelect} /></div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-5 border-b border-slate-200 p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-950">Desempenho por anúncio</h2>{drops.length > 0 ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">{drops.length} em queda</span> : null}</div><p className="mt-1.5 text-sm text-slate-500">Compare vendas, faturamento e variação para tomar decisões mais rápidas.</p></div><div className="flex flex-col gap-3 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou MLB" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-56" /></label><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1"><button onClick={() => setFilter('all')} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Todos</button><button onClick={() => setFilter('down')} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${filter === 'down' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Quedas</button></div></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50"><tr className="border-b border-slate-200 text-[11px] uppercase tracking-[0.12em] text-slate-500"><th className="px-4 py-3.5 font-bold lg:px-6">Produto / anúncio</th><th className="px-4 py-3.5 text-right font-bold lg:px-6">Vendas atuais</th><th className="px-4 py-3.5 text-right font-bold lg:px-6">Vendas anteriores</th><th className="px-4 py-3.5 text-right font-bold lg:px-6">Faturamento</th><th className="px-4 py-3.5 text-right font-bold lg:px-6">Variação</th><th className="px-4 py-3.5 text-right font-bold lg:px-6">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map((row: AggregatedSale) => <tr key={row.adId} className={`transition hover:bg-slate-50 ${row.variation !== null && row.variation < 0 ? 'bg-red-50/40' : ''}`}><td className="px-4 py-4 lg:px-6"><div className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${row.variation !== null && row.variation < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{row.title.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="max-w-[300px] truncate text-sm font-bold text-slate-800">{row.title}</p><p className="mt-0.5 text-xs font-medium text-slate-400">{row.adId}</p></div></div></td><td className="px-4 py-4 text-right text-sm font-bold tabular-nums text-slate-900 lg:px-6">{integer.format(row.currentUnits)}</td><td className="px-4 py-4 text-right text-sm tabular-nums text-slate-500 lg:px-6">{integer.format(row.previousUnits)}</td><td className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-slate-700 lg:px-6">{currency.format(row.currentRevenue)}</td><td className="px-4 py-4 text-right text-sm tabular-nums lg:px-6"><TableVariation value={row.variation} /></td><td className="px-4 py-4 text-right lg:px-6">{row.variation !== null && row.variation < 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700"><TrendingDown className="h-3.5 w-3.5" /> Revisar</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Saudável</span>}</td></tr>)}</tbody></table></div>
        {!filteredRows.length ? <div className="px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Search className="h-5 w-5" /></div><p className="mt-4 text-sm font-bold text-slate-700">{comparison.length ? 'Nenhum anúncio corresponde aos filtros.' : 'Importe os dois períodos para visualizar a comparação.'}</p><p className="mt-1 text-xs text-slate-400">Os registros processados aparecerão aqui.</p></div> : null}
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-6"><span>{filteredRows.length} anúncio{filteredRows.length === 1 ? '' : 's'} exibido{filteredRows.length === 1 ? '' : 's'}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Atualização baseada nos arquivos importados</span></div>
      </section>
    </main>

    <ExcelImportDialog open={dialogPeriod !== null} period={dialogPeriod ?? 'current'} onOpenChange={(open) => { if (!open) setDialogPeriod(null) }} onImportSuccess={handleImportSuccess} />
  </div>
}
