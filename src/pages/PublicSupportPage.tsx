import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Headphones,
  Loader2,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import {
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { useBranding } from '../branding/BrandContext'
import {
  buildMaintenanceSummary,
  MAINTENANCE_TRIAGE_FLOW,
} from '../features/maintenance-triage'
import {
  createPublicMaintenanceRequest,
  type MaintenanceIdentifierKind,
} from '../data/maintenance-request-service'

const inputClass =
  'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const textareaClass =
  'min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

export function PublicSupportPage() {
  const { branding } = useBranding()
  const startedAt = useRef(Date.now())

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [requestCode, setRequestCode] =
    useState<string | null>(null)
  const [
    assetRecognized,
    setAssetRecognized,
  ] = useState(false)

  const [requesterName, setRequesterName] =
    useState('')
  const [
    requesterEmail,
    setRequesterEmail,
  ] = useState('')
  const [
    requesterWhatsapp,
    setRequesterWhatsapp,
  ] = useState('')
  const [notifyEmail, setNotifyEmail] =
    useState(true)
  const [
    notifyWhatsapp,
    setNotifyWhatsapp,
  ] = useState(true)
  const [
    originOrganization,
    setOriginOrganization,
  ] = useState('')
  const [originUnit, setOriginUnit] =
    useState('')
  const [
    originEnvironment,
    setOriginEnvironment,
  ] = useState('')

  const [equipmentItems, setEquipmentItems] =
    useState<string[]>([])
  const [
    identifierKind,
    setIdentifierKind,
  ] =
    useState<MaintenanceIdentifierKind>(
      'unknown',
    )
  const [
    knownIdentifier,
    setKnownIdentifier,
  ] = useState('')
  const [manufacturer, setManufacturer] =
    useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] =
    useState('')

  const [
    problemCategory,
    setProblemCategory,
  ] = useState('')
  const [answers, setAnswers] = useState<
    Record<string, string>
  >({})
  const [
    completedChecks,
    setCompletedChecks,
  ] = useState<string[]>([])
  const [
    requesterNotes,
    setRequesterNotes,
  ] = useState('')
  const [website, setWebsite] =
    useState('')

  const topic = useMemo(
    () =>
      MAINTENANCE_TRIAGE_FLOW.topics.find(
        (item) =>
          item.id === problemCategory,
      ) ?? null,
    [problemCategory],
  )

  const summary = useMemo(
    () =>
      buildMaintenanceSummary({
        equipmentItems,
        problemCategory,
        answers,
        completedChecks,
        knownIdentifier,
        manufacturer,
        model,
        serialNumber,
        requesterNotes,
      }),
    [
      answers,
      completedChecks,
      equipmentItems,
      knownIdentifier,
      manufacturer,
      model,
      problemCategory,
      requesterNotes,
      serialNumber,
    ],
  )

  function toggleEquipment(id: string) {
    setEquipmentItems((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id,
          )
        : [...current, id],
    )
  }

  function chooseProblem(id: string) {
    setProblemCategory(id)
    setAnswers({})
    setCompletedChecks([])
  }

  const canContinue = useMemo(() => {
    if (step === 0) {
      return (
        requesterName.trim().length >= 3 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          requesterEmail.trim(),
        ) &&
        requesterWhatsapp.replace(
          /\D/g,
          '',
        ).length >= 10 &&
        originUnit.trim().length >= 2
      )
    }

    if (step === 1) {
      return equipmentItems.length > 0
    }

    if (step === 2) {
      return Boolean(
        topic &&
          topic.questions.every(
            (question) =>
              Boolean(
                answers[question.id],
              ),
          ),
      )
    }

    if (step === 3) {
      return Boolean(
        topic &&
          topic.checks.length > 0 &&
          completedChecks.length ===
            topic.checks.length,
      )
    }

    return true
  }, [
    answers,
    completedChecks.length,
    equipmentItems.length,
    originUnit,
    requesterEmail,
    requesterName,
    requesterWhatsapp,
    step,
    topic,
  ])

  async function submit() {
    if (!topic) return

    try {
      setSubmitting(true)
      setErrorMessage(null)

      const result =
        await createPublicMaintenanceRequest({
          requesterName,
          requesterEmail,
          requesterWhatsapp,
          notifyEmail,
          notifyWhatsapp,
          originOrganization,
          originUnit,
          originEnvironment,
          equipmentItems,
          identifierKind,
          knownIdentifier,
          manufacturer,
          model,
          serialNumber,
          problemCategory,
          answers,
          completedChecks,
          summaryText: summary,
          requesterNotes,
          triageFlowVersion:
            MAINTENANCE_TRIAGE_FLOW.version,
          formElapsedMs:
            Date.now() -
            startedAt.current,
          website,
        })

      setRequestCode(
        result.requestCode,
      )
      setAssetRecognized(
        result.assetRecognized,
      )
      setStep(4)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar o chamado.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const progress =
    step >= 4
      ? 100
      : ((step + 1) / 4) * 100

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={
                  branding.organizationName ||
                  'Logomarca institucional'
                }
                className="h-10 max-w-32 object-contain"
              />
            ) : (
              <div className="grid size-10 place-items-center rounded-2xl bg-slate-950 text-sky-400">
                <Wrench size={18} />
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate text-sm font-black">
                {branding.organizationName ||
                  'Inventário TI'}
              </div>
              <div className="text-[11px] text-slate-400">
                Central de suporte
              </div>
            </div>
          </div>

          <Link
            to="/login"
            className="text-xs font-bold text-slate-400 hover:text-slate-700"
          >
            Acesso técnico
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {step === 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                <Headphones size={19} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">
                  Quem está solicitando?
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Precisamos saber de onde vem o equipamento e como entrar em contato.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Seu nome">
                <input
                  className={inputClass}
                  value={requesterName}
                  onChange={(event) =>
                    setRequesterName(
                      event.target.value,
                    )
                  }
                />
              </Field>

              <Field label="E-mail">
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="email"
                  value={requesterEmail}
                  onChange={(event) =>
                    setRequesterEmail(
                      event.target.value,
                    )
                  }
                  placeholder="nome@exemplo.com"
                />
              </Field>

              <Field label="WhatsApp">
                <input
                  className={inputClass}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={requesterWhatsapp}
                  onChange={(event) =>
                    setRequesterWhatsapp(
                      event.target.value,
                    )
                  }
                  placeholder="(00) 00000-0000"
                />
              </Field>

              <Field label="Instituição / organização">
                <input
                  className={inputClass}
                  value={originOrganization}
                  onChange={(event) =>
                    setOriginOrganization(
                      event.target.value,
                    )
                  }
                  placeholder="Opcional"
                />
              </Field>

              <Field label="Unidade / setor">
                <input
                  className={inputClass}
                  value={originUnit}
                  onChange={(event) =>
                    setOriginUnit(
                      event.target.value,
                    )
                  }
                  placeholder="Ex.: Secretaria, recepção, sala 2"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Local / sala">
                  <input
                    className={inputClass}
                    value={originEnvironment}
                    onChange={(event) =>
                      setOriginEnvironment(
                        event.target.value,
                      )
                    }
                    placeholder="Opcional"
                  />
                </Field>
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black text-slate-700">
                  Atualizações do atendimento
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-start gap-3 text-xs font-semibold leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(event) =>
                        setNotifyEmail(
                          event.target.checked,
                        )
                      }
                      className="mt-0.5 size-4 rounded border-slate-300"
                    />
                    Quero receber atualizações por e-mail.
                  </label>

                  <label className="flex items-start gap-3 text-xs font-semibold leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={notifyWhatsapp}
                      onChange={(event) =>
                        setNotifyWhatsapp(
                          event.target.checked,
                        )
                      }
                      className="mt-0.5 size-4 rounded border-slate-300"
                    />
                    Autorizo contato e atualizações pelo WhatsApp.
                  </label>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="hidden"
              >
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) =>
                    setWebsite(
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h1 className="text-xl font-black tracking-tight">
              O que será enviado?
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Marque todos os itens que acompanham o equipamento.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MAINTENANCE_TRIAGE_FLOW.equipment.map(
                (item) => {
                  const selected =
                    equipmentItems.includes(
                      item.id,
                    )

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        toggleEquipment(
                          item.id,
                        )
                      }
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                        selected
                          ? 'border-sky-400 bg-sky-50 text-sky-800'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                          selected
                            ? 'border-sky-500 bg-sky-500 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {selected && (
                          <Check size={13} />
                        )}
                      </span>
                      {item.label}
                    </button>
                  )
                },
              )}
            </div>

            <div className="mt-7 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-black">
                Identificação do equipamento
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Preencha o que souber. O chamado pode ser aberto mesmo sem patrimônio cadastrado.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Tipo de identificação">
                  <select
                    className={inputClass}
                    value={identifierKind}
                    onChange={(event) =>
                      setIdentifierKind(
                        event.target
                          .value as MaintenanceIdentifierKind,
                      )
                    }
                  >
                    <option value="unknown">
                      Não sei / não possui
                    </option>
                    <option value="internal">
                      Código interno do patrimônio
                    </option>
                    <option value="patrimony">
                      Patrimônio / tombamento externo
                    </option>
                    <option value="serial">
                      Número de série do fabricante
                    </option>
                    <option value="other">
                      Outra identificação
                    </option>
                  </select>
                </Field>

                <Field label="Número / código">
                  <input
                    className={inputClass}
                    value={knownIdentifier}
                    onChange={(event) =>
                      setKnownIdentifier(
                        event.target.value,
                      )
                    }
                    placeholder="Se existir"
                  />
                </Field>

                <Field label="Fabricante">
                  <input
                    className={inputClass}
                    value={manufacturer}
                    onChange={(event) =>
                      setManufacturer(
                        event.target.value,
                      )
                    }
                    placeholder="Opcional"
                  />
                </Field>

                <Field label="Modelo">
                  <input
                    className={inputClass}
                    value={model}
                    onChange={(event) =>
                      setModel(
                        event.target.value,
                      )
                    }
                    placeholder="Opcional"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Número de série do fabricante">
                    <input
                      className={inputClass}
                      value={serialNumber}
                      onChange={(event) =>
                        setSerialNumber(
                          event.target.value,
                        )
                      }
                      placeholder="Opcional"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h1 className="text-xl font-black tracking-tight">
              O que está acontecendo?
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Escolha o problema mais parecido. Não é necessário conhecer termos técnicos.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {MAINTENANCE_TRIAGE_FLOW.topics.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      chooseProblem(item.id)
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      problemCategory ===
                      item.id
                        ? 'border-sky-400 bg-sky-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-black">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {item.description}
                    </div>
                  </button>
                ),
              )}
            </div>

            {topic && (
              <div className="mt-7 space-y-5 border-t border-slate-100 pt-6">
                {topic.questions.map(
                  (question) => (
                    <div
                      key={question.id}
                    >
                      <div className="text-sm font-bold text-slate-800">
                        {question.label}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {question.options.map(
                          (option) => (
                            <button
                              key={
                                option.id
                              }
                              type="button"
                              onClick={() =>
                                setAnswers(
                                  (current) => ({
                                    ...current,
                                    [question.id]:
                                      option.id,
                                  }),
                                )
                              }
                              className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold transition ${
                                answers[
                                  question.id
                                ] ===
                                option.id
                                  ? 'border-sky-400 bg-sky-50 text-sky-800'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {option.label}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ),
                )}

                <Field label="Conte algo importante que não perguntamos">
                  <textarea
                    className={
                      textareaClass
                    }
                    value={requesterNotes}
                    onChange={(event) =>
                      setRequesterNotes(
                        event.target.value,
                      )
                    }
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            )}
          </section>
        )}

        {step === 3 && topic && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <ClipboardCheck
                  size={19}
                />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">
                  Antes de enviar
                </h1>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Confira estas verificações simples. Não abra o equipamento e não retire componentes.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {topic.checks.map((item) => {
                const checked =
                  completedChecks.includes(
                    item.id,
                  )

                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                      checked
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setCompletedChecks(
                          (current) =>
                            current.includes(
                              item.id,
                            )
                              ? current.filter(
                                  (id) =>
                                    id !==
                                    item.id,
                                )
                              : [
                                  ...current,
                                  item.id,
                                ],
                        )
                      }
                      className="mt-0.5 size-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold leading-6 text-slate-700">
                      {item.label}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Resumo técnico preliminar
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {summary}
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0"
              />
              Este resumo organiza o relato para a equipe técnica. Não representa diagnóstico definitivo.
            </div>
          </section>
        )}

        {step === 4 && requestCode && (
          <section className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={27} />
            </div>
            <h1 className="mt-4 text-2xl font-black">
              Chamado enviado
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Guarde este protocolo para informar à equipe de TI.
            </p>

            <div className="mx-auto mt-5 max-w-sm rounded-2xl bg-slate-950 p-5 text-white">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Protocolo
              </div>
              <div className="mt-2 font-mono text-xl font-black">
                {requestCode}
              </div>
            </div>

            {assetRecognized && (
              <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
                A identificação informada correspondeu a um patrimônio já cadastrado.
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                void navigator.clipboard.writeText(
                  requestCode,
                )
              }
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
            >
              <Copy size={15} />
              Copiar protocolo
            </button>
          </section>
        )}

        {step < 4 && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={() =>
                setStep((current) =>
                  Math.max(
                    0,
                    current - 1,
                  ),
                )
              }
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 disabled:opacity-30"
            >
              <ArrowLeft size={15} />
              Voltar
            </button>

            {step < 3 ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() =>
                  setStep((current) =>
                    Math.min(
                      3,
                      current + 1,
                    ),
                  )
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-30"
              >
                Continuar
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  !canContinue ||
                  submitting
                }
                onClick={() =>
                  void submit()
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-30"
              >
                {submitting ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={15}
                  />
                )}
                Enviar chamado
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  )
}
