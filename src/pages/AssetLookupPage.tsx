import {
  Building2,
  FileSearch,
  ReceiptText,
  Search,
} from 'lucide-react'
import {
  useState,
  type FormEvent,
} from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../components/ui/PageHeader'
import {
  searchSmartAssets,
} from '../data/asset-smart-service'
import type {
  AssetSmartSearchResult,
} from '../types/asset-smart'

export function AssetLookupPage() {
  const [query, setQuery] =
    useState('')
  const [results, setResults] =
    useState<AssetSmartSearchResult[]>(
      [],
    )
  const [searched, setSearched] =
    useState(false)
  const [loading, setLoading] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!query.trim()) return

    try {
      setLoading(true)
      setErrorMessage(null)

      const rows =
        await searchSmartAssets(query)

      setResults(rows)
      setSearched(true)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível pesquisar.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Patrimônio"
        title="Localizar ativo"
        description="Pesquise pelo nosso código, serial, Service Tag, Product Number, patrimônio de outro órgão, instituição ou nota fiscal."
      />

      <form
        onSubmit={(event) =>
          void submit(event)
        }
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              placeholder="Ex.: WIS-MON-000001, serial, SES-483927, NF 58742..."
            />
          </div>

          <button
            type="submit"
            disabled={
              loading || !query.trim()
            }
            className="h-12 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40"
          >
            {loading
              ? 'Buscando...'
              : 'Buscar'}
          </button>
        </div>
      </form>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {searched &&
        results.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <FileSearch
              size={24}
              className="mx-auto text-slate-300"
            />
            <div className="mt-3 text-sm font-bold text-slate-800">
              Nenhum ativo localizado
            </div>
          </div>
        )}

      <div className="grid gap-3">
        {results.map((item) => (
          <Link
            key={item.id}
            to={`/patrimonio/${item.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-black text-slate-950">
                  {item.asset_code}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-700">
                  {[
                    item.manufacturer,
                    item.model,
                  ]
                    .filter(Boolean)
                    .join(' ') ||
                    'Ativo'}
                </div>

                <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] text-slate-500">
                  {item.serial_number && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      SN{' '}
                      {
                        item.serial_number
                      }
                    </span>
                  )}
                  {item.service_tag && (
                    <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                      TAG{' '}
                      {item.service_tag}
                    </span>
                  )}
                  {item.product_number && (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      P/N{' '}
                      {
                        item.product_number
                      }
                    </span>
                  )}
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase text-slate-500">
                {item.ownership_type}
              </span>
            </div>

            {item.external_identifiers
              .length > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
                  <Building2
                    size={12}
                  />
                  Identificadores externos
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.external_identifiers.map(
                    (
                      identifier,
                      index,
                    ) => (
                      <span
                        key={`${identifier.value}-${index}`}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] text-slate-700"
                      >
                        {
                          identifier.value
                        }{' '}
                        ·{' '}
                        {
                          identifier.organization
                        }
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {item.purchase_documents
              .length > 0 && (
              <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                <ReceiptText
                  size={13}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  NF/Documento:{' '}
                  {item.purchase_documents
                    .map(
                      (document) =>
                        document.series
                          ? `${document.number}/${document.series}`
                          : document.number,
                    )
                    .join(' · ')}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
