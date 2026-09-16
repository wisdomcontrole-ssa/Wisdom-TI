import {
  buildMaintenanceSummary,
  MAINTENANCE_TRIAGE_FLOW,
} from '../src/features/maintenance-triage'

function assert(
  condition: unknown,
  message: string,
) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(
  MAINTENANCE_TRIAGE_FLOW.topics.length >=
    8,
  'A triagem precisa cobrir os principais cenários.',
)

for (const topic of
  MAINTENANCE_TRIAGE_FLOW.topics) {
  assert(
    topic.questions.length >= 1 &&
      topic.questions.length <= 4,
    `${topic.id}: a anamnese ficou longa demais.`,
  )

  assert(
    topic.checks.length >= 1 &&
      topic.checks.length <= 4,
    `${topic.id}: checklist fora do limite.`,
  )
}

const summary =
  buildMaintenanceSummary({
    equipmentItems: [
      'desktop',
      'monitor',
    ],
    problemCategory: 'no_power',
    answers: {
      power_sign: 'none',
      frequency: 'always',
    },
    completedChecks: [
      'outlet',
      'power_cable',
      'power_strip',
    ],
    knownIdentifier:
      'WIS-DT-000081',
  })

assert(
  summary.includes(
    'Gabinete / computador',
  ),
  'Resumo não trouxe os itens enviados.',
)

assert(
  summary.includes('Não liga'),
  'Resumo não trouxe o problema principal.',
)

assert(
  summary.includes(
    'WIS-DT-000081',
  ),
  'Resumo não trouxe a identificação.',
)

const physical =
  MAINTENANCE_TRIAGE_FLOW.topics.find(
    (item) => item.id === 'physical',
  )

assert(
  physical?.checks.some((check) =>
    check.label.includes(
      'Não tentei ligar novamente',
    ),
  ),
  'Fluxo de dano físico precisa orientar a não religar.',
)

console.log(
  'OK: M15 triagem curta, resumo determinístico e checklist seguro validados.',
)