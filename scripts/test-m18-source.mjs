import fs from 'node:fs'
const checks = [
 ['src/pages/BlankLabelsPage.tsx','issuePreprintedLabels'],
 ['src/pages/QuickLabelRegistrationPage.tsx','SmartLabelReader'],
 ['src/pages/QuickLabelRegistrationPage.tsx','Código de terceiro'],
 ['src/data/preprinted-labels-service.ts','m18_claim_label'],
 ['src/App.tsx','/etiquetas/antecipadas'],
 ['src/App.tsx','/cadastro-etiqueta/:code'],
 ['src/pages/IdentifyCodePage.tsx','findPreprintedLabel'],
 ['src/pages/FieldScannerPage.tsx','findPreprintedLabel'],
 ['src/pages/LabelsPage.tsx','Etiquetas antecipadas'],
 ['supabase/migrations/20261030180000_m18_reserved_labels.sql','m18_issue_labels'],
 ['supabase/migrations/20261030180000_m18_reserved_labels.sql','for update'],
 ['supabase/migrations/20261030180000_m18_reserved_labels.sql','has_permission']
]
let failed=0
for (const [p,token] of checks) {
 const ok=fs.existsSync(p) && fs.readFileSync(p,'utf8').includes(token)
 console.log(`${ok?'[OK]':'[ERRO]'} ${p}: ${token}`)
 if (!ok) failed++
}
if (failed) process.exit(1)
console.log('M18 SOURCE OK')
