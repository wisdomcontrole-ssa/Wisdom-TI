export interface MaintenanceTriageOption {
  id: string
  label: string
  phrase?: string
}

export interface MaintenanceTriageQuestion {
  id: string
  label: string
  options: MaintenanceTriageOption[]
}

export interface MaintenanceTriageCheck {
  id: string
  label: string
}

export interface MaintenanceTriageTopic {
  id: string
  label: string
  description: string
  questions: MaintenanceTriageQuestion[]
  checks: MaintenanceTriageCheck[]
}

export interface MaintenanceTriageFlow {
  version: number
  equipment: Array<{
    id: string
    label: string
  }>
  topics: MaintenanceTriageTopic[]
}

export const MAINTENANCE_TRIAGE_FLOW: MaintenanceTriageFlow =
{
  "version": 1,
  "equipment": [
    {
      "id": "desktop",
      "label": "Gabinete / computador"
    },
    {
      "id": "notebook",
      "label": "Notebook"
    },
    {
      "id": "monitor",
      "label": "Monitor"
    },
    {
      "id": "mouse",
      "label": "Mouse"
    },
    {
      "id": "keyboard",
      "label": "Teclado"
    },
    {
      "id": "charger",
      "label": "Fonte / carregador"
    },
    {
      "id": "printer",
      "label": "Impressora"
    },
    {
      "id": "ups",
      "label": "Nobreak / estabilizador"
    },
    {
      "id": "network",
      "label": "Equipamento de rede"
    },
    {
      "id": "other",
      "label": "Outro item"
    }
  ],
  "topics": [
    {
      "id": "no_power",
      "label": "Não liga",
      "description": "Nenhum sinal de energia ou funcionamento.",
      "questions": [
        {
          "id": "power_sign",
          "label": "Ao apertar o botão de ligar, o que acontece?",
          "options": [
            {
              "id": "none",
              "label": "Nada acontece",
              "phrase": "não apresenta sinal de energia"
            },
            {
              "id": "brief",
              "label": "Liga por poucos segundos e desliga",
              "phrase": "liga por poucos segundos e desliga"
            },
            {
              "id": "lights",
              "label": "Há luzes ou ventoinha, mas não inicia",
              "phrase": "apresenta energia, mas não inicia corretamente"
            }
          ]
        },
        {
          "id": "frequency",
          "label": "Isso acontece com que frequência?",
          "options": [
            {
              "id": "always",
              "label": "Sempre",
              "phrase": "a falha ocorre em todas as tentativas"
            },
            {
              "id": "sometimes",
              "label": "Às vezes",
              "phrase": "a falha é intermitente"
            },
            {
              "id": "after_move",
              "label": "Depois que foi movimentado",
              "phrase": "o problema começou após movimentação do equipamento"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "outlet",
          "label": "Confirmei que a tomada ou filtro de linha tem energia."
        },
        {
          "id": "power_cable",
          "label": "Retirei e reconectei o cabo de energia/fonte, quando aplicável."
        },
        {
          "id": "power_strip",
          "label": "Conferi se filtro de linha, nobreak ou estabilizador está ligado."
        }
      ]
    },
    {
      "id": "no_video",
      "label": "Liga, mas não aparece imagem",
      "description": "Há sinais de energia, porém a tela fica sem imagem.",
      "questions": [
        {
          "id": "screen",
          "label": "O que aparece no monitor?",
          "options": [
            {
              "id": "no_signal",
              "label": "Sem sinal / No signal",
              "phrase": "o monitor informa ausência de sinal"
            },
            {
              "id": "black",
              "label": "Tela preta, sem mensagem",
              "phrase": "o monitor permanece com tela preta"
            },
            {
              "id": "then_black",
              "label": "Mostra algo e depois apaga",
              "phrase": "há imagem inicialmente e depois a tela apaga"
            }
          ]
        },
        {
          "id": "pc_on",
          "label": "O computador parece estar ligado?",
          "options": [
            {
              "id": "yes",
              "label": "Sim, há luzes ou ventoinha",
              "phrase": "o computador aparenta estar energizado"
            },
            {
              "id": "unknown",
              "label": "Não tenho certeza",
              "phrase": "não foi possível confirmar se o computador está ligado"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "monitor_power",
          "label": "Confirmei que o monitor está ligado e com luz de energia."
        },
        {
          "id": "video_cable",
          "label": "Retirei e reconectei o cabo de vídeo nas duas extremidades."
        },
        {
          "id": "input",
          "label": "Conferi se a entrada/fonte correta está selecionada no monitor."
        }
      ]
    },
    {
      "id": "boot_restart",
      "label": "Não inicia ou reinicia",
      "description": "Liga, mas não conclui a inicialização ou reinicia sozinho.",
      "questions": [
        {
          "id": "boot_stage",
          "label": "Até onde o equipamento chega?",
          "options": [
            {
              "id": "brand",
              "label": "Só aparece a marca do fabricante",
              "phrase": "a inicialização para na tela do fabricante"
            },
            {
              "id": "windows",
              "label": "Chega ao Windows e reinicia",
              "phrase": "chega ao Windows e reinicia"
            },
            {
              "id": "login",
              "label": "Chega ao login e trava",
              "phrase": "chega à tela de login e trava"
            },
            {
              "id": "random",
              "label": "Reinicia em momentos diferentes",
              "phrase": "reinicia em momentos diferentes da inicialização"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "restart_once",
          "label": "Desliguei normalmente quando possível, aguardei alguns segundos e tentei ligar novamente."
        },
        {
          "id": "remove_usb",
          "label": "Retirei pendrives e acessórios USB não essenciais antes de testar novamente."
        }
      ]
    },
    {
      "id": "blue_screen",
      "label": "Tela azul / erro crítico",
      "description": "Aparece tela azul, código de erro ou reinicialização inesperada.",
      "questions": [
        {
          "id": "blue_frequency",
          "label": "A tela azul já aconteceu mais de uma vez?",
          "options": [
            {
              "id": "once",
              "label": "Aconteceu uma vez",
              "phrase": "houve um episódio de tela azul"
            },
            {
              "id": "many",
              "label": "Acontece repetidamente",
              "phrase": "a tela azul é recorrente"
            },
            {
              "id": "startup",
              "label": "Acontece na inicialização",
              "phrase": "a tela azul ocorre durante a inicialização"
            }
          ]
        },
        {
          "id": "recent_change",
          "label": "Houve alguma mudança recente?",
          "options": [
            {
              "id": "software",
              "label": "Programa ou atualização",
              "phrase": "houve instalação ou atualização recente de software"
            },
            {
              "id": "hardware",
              "label": "Peça ou periférico novo",
              "phrase": "houve alteração recente de hardware ou periférico"
            },
            {
              "id": "none",
              "label": "Não que eu saiba",
              "phrase": "não foi identificada mudança recente"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "photo_code",
          "label": "Anotei ou fotografei o código/mensagem da tela azul, quando apareceu."
        },
        {
          "id": "recent_usb",
          "label": "Desconectei periféricos USB adicionados recentemente e testei novamente."
        }
      ]
    },
    {
      "id": "slow",
      "label": "Muito lento / travando",
      "description": "O equipamento funciona, mas fica lento ou para de responder.",
      "questions": [
        {
          "id": "slow_when",
          "label": "Quando a lentidão aparece?",
          "options": [
            {
              "id": "startup",
              "label": "Desde que liga",
              "phrase": "fica lento desde a inicialização"
            },
            {
              "id": "program",
              "label": "Ao abrir programas",
              "phrase": "a lentidão aumenta ao abrir programas"
            },
            {
              "id": "time",
              "label": "Depois de algum tempo",
              "phrase": "a lentidão aparece após algum tempo de uso"
            },
            {
              "id": "random",
              "label": "Sem padrão",
              "phrase": "a lentidão não apresenta padrão claro"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "restart",
          "label": "Salvei o trabalho e reiniciei o computador uma vez."
        },
        {
          "id": "close_apps",
          "label": "Fechei programas que não estavam sendo usados e confirmei se a lentidão continuou."
        }
      ]
    },
    {
      "id": "network",
      "label": "Internet / rede",
      "description": "Sem internet, Wi-Fi, cabo de rede ou acesso aos sistemas.",
      "questions": [
        {
          "id": "connection",
          "label": "Como o equipamento se conecta?",
          "options": [
            {
              "id": "wifi",
              "label": "Wi-Fi",
              "phrase": "a conexão utilizada é Wi-Fi"
            },
            {
              "id": "cable",
              "label": "Cabo de rede",
              "phrase": "a conexão utilizada é por cabo"
            },
            {
              "id": "both",
              "label": "Já testei os dois",
              "phrase": "Wi-Fi e cabo foram testados"
            }
          ]
        },
        {
          "id": "others",
          "label": "Outros equipamentos no mesmo local estão com internet?",
          "options": [
            {
              "id": "yes",
              "label": "Sim",
              "phrase": "outros equipamentos no local continuam conectados"
            },
            {
              "id": "no",
              "label": "Não",
              "phrase": "outros equipamentos no local também estão sem conexão"
            },
            {
              "id": "unknown",
              "label": "Não sei",
              "phrase": "não foi possível comparar com outros equipamentos"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "airplane",
          "label": "Confirmei que Wi-Fi está ligado e modo avião está desligado, quando aplicável."
        },
        {
          "id": "cable",
          "label": "Conferi o cabo de rede, quando o equipamento usa cabo."
        },
        {
          "id": "restart_pc",
          "label": "Reiniciei apenas o computador e verifiquei novamente a conexão."
        }
      ]
    },
    {
      "id": "peripheral",
      "label": "Mouse, teclado ou periférico",
      "description": "Um acessório não funciona ou funciona de forma intermitente.",
      "questions": [
        {
          "id": "which",
          "label": "Qual item apresenta o problema?",
          "options": [
            {
              "id": "mouse",
              "label": "Mouse",
              "phrase": "o problema está no mouse"
            },
            {
              "id": "keyboard",
              "label": "Teclado",
              "phrase": "o problema está no teclado"
            },
            {
              "id": "usb",
              "label": "Dispositivo USB",
              "phrase": "o problema está em um dispositivo USB"
            },
            {
              "id": "other",
              "label": "Outro periférico",
              "phrase": "o problema está em outro periférico"
            }
          ]
        },
        {
          "id": "behavior",
          "label": "Como ele falha?",
          "options": [
            {
              "id": "never",
              "label": "Não funciona",
              "phrase": "o periférico não funciona"
            },
            {
              "id": "intermittent",
              "label": "Funciona e para",
              "phrase": "o periférico funciona de forma intermitente"
            },
            {
              "id": "wrong",
              "label": "Funciona de forma incorreta",
              "phrase": "o periférico responde de forma incorreta"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "reconnect",
          "label": "Desconectei e conectei novamente o periférico."
        },
        {
          "id": "other_port",
          "label": "Testei outra porta compatível, quando disponível."
        }
      ]
    },
    {
      "id": "thermal",
      "label": "Esquenta, faz barulho ou desliga",
      "description": "Aquecimento, ruído ou desligamento durante o uso.",
      "questions": [
        {
          "id": "signal",
          "label": "Qual sinal você percebe?",
          "options": [
            {
              "id": "hot",
              "label": "Muito quente",
              "phrase": "há aquecimento excessivo percebido"
            },
            {
              "id": "fan",
              "label": "Ventoinha muito forte",
              "phrase": "a ventoinha trabalha de forma intensa"
            },
            {
              "id": "noise",
              "label": "Ruído mecânico",
              "phrase": "há ruído mecânico anormal"
            },
            {
              "id": "shutdown",
              "label": "Desliga sozinho",
              "phrase": "o equipamento desliga durante o uso"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "airflow",
          "label": "Confirmei que entradas e saídas de ar não estão bloqueadas por objetos."
        },
        {
          "id": "burn",
          "label": "Se houve cheiro de queimado ou fumaça, desliguei e não tentei ligar novamente."
        }
      ]
    },
    {
      "id": "software",
      "label": "Programa / Windows",
      "description": "Erro em aplicativo, sistema operacional, acesso ou atualização.",
      "questions": [
        {
          "id": "scope",
          "label": "Onde o problema acontece?",
          "options": [
            {
              "id": "app",
              "label": "Em um programa específico",
              "phrase": "o problema está concentrado em um programa"
            },
            {
              "id": "windows",
              "label": "No Windows em geral",
              "phrase": "o problema afeta o Windows de forma geral"
            },
            {
              "id": "login",
              "label": "No acesso / login",
              "phrase": "o problema ocorre no acesso ou autenticação"
            },
            {
              "id": "update",
              "label": "Depois de uma atualização",
              "phrase": "o problema começou após uma atualização"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "restart",
          "label": "Fechei e abri novamente o programa ou reiniciei o computador."
        },
        {
          "id": "error",
          "label": "Anotei ou fotografei a mensagem de erro, quando apareceu."
        }
      ]
    },
    {
      "id": "physical",
      "label": "Queda, líquido ou dano físico",
      "description": "Houve impacto, líquido, cheiro de queimado ou dano visível.",
      "questions": [
        {
          "id": "kind",
          "label": "O que aconteceu?",
          "options": [
            {
              "id": "fall",
              "label": "Queda / impacto",
              "phrase": "houve queda ou impacto"
            },
            {
              "id": "liquid",
              "label": "Contato com líquido",
              "phrase": "houve contato com líquido"
            },
            {
              "id": "burn",
              "label": "Cheiro de queimado / fumaça",
              "phrase": "foi percebido cheiro de queimado ou fumaça"
            },
            {
              "id": "broken",
              "label": "Peça ou carcaça quebrada",
              "phrase": "há dano físico visível"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "power_off",
          "label": "Desliguei o equipamento e desconectei da energia, quando foi seguro fazer isso."
        },
        {
          "id": "no_restart",
          "label": "Não tentei ligar novamente após líquido, fumaça ou cheiro de queimado."
        }
      ]
    },
    {
      "id": "unknown",
      "label": "Não sei identificar",
      "description": "Algo está errado, mas não consigo classificar o problema.",
      "questions": [
        {
          "id": "effect",
          "label": "Qual é o principal efeito percebido?",
          "options": [
            {
              "id": "cannot_use",
              "label": "Não consigo usar o equipamento",
              "phrase": "o equipamento está impedindo o uso"
            },
            {
              "id": "sometimes",
              "label": "Funciona, mas falha às vezes",
              "phrase": "a falha é intermitente"
            },
            {
              "id": "different",
              "label": "Está funcionando de forma diferente",
              "phrase": "o comportamento do equipamento mudou"
            }
          ]
        }
      ],
      "checks": [
        {
          "id": "restart",
          "label": "Reiniciei o equipamento uma vez, quando foi seguro fazer isso."
        },
        {
          "id": "observe",
          "label": "Observei quando o problema acontece para conseguir descrevê-lo ao técnico."
        }
      ]
    }
  ]
}

export function buildMaintenanceSummary(input: {
  equipmentItems: string[]
  problemCategory: string
  answers: Record<string, string>
  completedChecks: string[]
  knownIdentifier?: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  requesterNotes?: string
}) {
  const equipmentMap = new Map(
    MAINTENANCE_TRIAGE_FLOW.equipment.map(
      (item) => [item.id, item.label],
    ),
  )

  const topic =
    MAINTENANCE_TRIAGE_FLOW.topics.find(
      (item) =>
        item.id === input.problemCategory,
    )

  const equipmentLabels =
    input.equipmentItems
      .map((id) => equipmentMap.get(id))
      .filter(
        (value): value is string =>
          Boolean(value),
      )

  const answerPhrases =
    topic?.questions
      .map((question) => {
        const answerId =
          input.answers[question.id]

        if (!answerId) {
          return ''
        }

        const option =
          question.options.find(
            (item) =>
              item.id === answerId,
          )

        return (
          option?.phrase ??
          option?.label ??
          ''
        )
      })
      .filter(Boolean) ?? []

  const identity = [
    input.knownIdentifier
      ? `identificação informada: ${input.knownIdentifier.trim()}`
      : '',
    input.manufacturer
      ? `fabricante: ${input.manufacturer.trim()}`
      : '',
    input.model
      ? `modelo: ${input.model.trim()}`
      : '',
    input.serialNumber
      ? `série: ${input.serialNumber.trim()}`
      : '',
  ].filter(Boolean)

  const parts = [
    equipmentLabels.length
      ? `Itens informados para atendimento: ${equipmentLabels.join(', ')}.`
      : '',
    topic
      ? `Problema principal relatado: ${topic.label}.`
      : '',
    answerPhrases.length
      ? `${answerPhrases.join('. ')}.`
      : '',
    identity.length
      ? `${identity.join('; ')}.`
      : '',
    topic?.checks.length
      ? `Verificações orientadas foram confirmadas (${input.completedChecks.length} de ${topic.checks.length}).`
      : '',
    input.requesterNotes?.trim()
      ? `Observação do solicitante: ${input.requesterNotes.trim()}`
      : '',
  ].filter(Boolean)

  return parts.join(' ')
}