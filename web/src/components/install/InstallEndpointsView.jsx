/**
 * @file web/src/components/install/InstallEndpointsView.jsx
 * @description Install Endpoints wizard — 4-step modal: provider → tool → models → install.
 * 📖 M4: Full TUI parity for the install endpoints overlay.
 * 📖 Uses existing /api/install-endpoints/providers, /api/install-endpoints/catalog,
 * 📖 and /api/install-endpoints/wizard endpoints.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  IconPlug, IconChevronRight, IconChevronLeft, IconCheck,
  IconLoader,
} from '@tabler/icons-react'
import styles from './InstallEndpointsView.module.css'
import { useI18n } from '../../i18n.jsx'

const STEP_KEYS = ['install.step.provider', 'install.step.tool', 'install.step.models', 'install.step.install']
const STEPS = ['Provider', 'Tool', 'Models', 'Install']

export default function InstallEndpointsView({ onClose, onToast }) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [catalogModels, setCatalogModels] = useState([])
  const [selectedTool, setSelectedTool] = useState(null)
  const [selectedModels, setSelectedModels] = useState([])
  const [scope, setScope] = useState('all')
  const [installing, setInstalling] = useState(false)
  const [installResult, setInstallResult] = useState(null)
  const [loading, setLoading] = useState(true)

  // 📖 Available install targets from ToolPicker's mode list
  const TOOLS = [
    { id: 'opencode', label: 'OpenCode CLI', emoji: '💻' },
    { id: 'opencode-desktop', label: 'OpenCode Desktop', emoji: '🖥️' },
    { id: 'openclaw', label: 'OpenClaw', emoji: '🦞' },
    { id: 'crush', label: 'Crush', emoji: '💘' },
    { id: 'goose', label: 'Goose', emoji: '🪿' },
    { id: 'pi', label: 'Pi', emoji: 'π' },
    { id: 'aider', label: 'Aider', emoji: '🛠' },
    { id: 'qwen', label: 'Qwen', emoji: '🐉' },
    { id: 'openhands', label: 'OpenHands', emoji: '🤲' },
    { id: 'amp', label: 'Amp', emoji: '⚡' },
    { id: 'forgecode', label: 'ForgeCode', emoji: '🔥' },
    { id: 'zcode', label: 'ZCode', emoji: '🧊' },
    { id: 'fcm_router', label: 'FCM Router', emoji: '🔄' },
  ]

  // Load providers on mount
  useEffect(() => {
    fetch('/api/install-endpoints/providers')
      .then(r => r.json())
      .then(data => {
        setProviders(data.providers || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Load catalog when provider selected
  useEffect(() => {
    if (!selectedProvider) return
    fetch(`/api/install-endpoints/catalog?provider=${selectedProvider.providerKey}`)
      .then(r => r.json())
      .then(data => setCatalogModels(data.models || []))
      .catch(() => setCatalogModels([]))
  }, [selectedProvider])

  const toggleModel = useCallback((modelId) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    )
  }, [])

  const selectAll = useCallback(() => {
    setSelectedModels(catalogModels.map(m => m.modelId))
    setScope('all')
  }, [catalogModels])

  const selectNone = useCallback(() => {
    setSelectedModels([])
    setScope('selected')
  }, [])

  const canNext = () => {
    if (step === 0) return !!selectedProvider
    if (step === 1) return !!selectedTool
    if (step === 2) return scope === 'all' || selectedModels.length > 0
    return true
  }

  const handleInstall = async () => {
    // 📖 Avance au step 3 d'abord (animation "installing"), puis lance l'install
    setStep(3)
    setInstalling(true)
    setInstallResult(null)
    try {
      const resp = await fetch('/api/install-endpoints/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKey: selectedProvider.providerKey,
          toolMode: selectedTool,
          scope,
          modelIds: scope === 'selected' ? selectedModels : [],
        }),
      })
      const data = await resp.json()
      if (data.success) {
        setInstallResult(data)
        onToast?.(`${t('install.installed')} ${t('install.modelsCount', { count: data.modelCount })} ${selectedProvider.label} → ${TOOLS.find(t => t.id === selectedTool)?.label || selectedTool}.`, 'success')
      } else {
        setInstallResult(null)
        onToast?.(`${t('install.installFailed')}: ${data.error || t('common.unknown')}`, 'error')
        // 📖 Retour au step 2 si l'install échoue pour laisser réessayer
        setStep(2)
      }
    } catch (err) {
      setInstallResult(null)
      onToast?.(`${t('install.installFailed')}: ${err.message}`, 'error')
      setStep(2)
    } finally {
      setInstalling(false)
    }
  }

  const handleNext = () => {
    if (step === 2) {
      handleInstall()
      return
    }
    setStep(s => Math.min(s + 1, 3))
  }

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 0))
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <IconPlug size={20} stroke={1.5} />
            {t('install.title')}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        {/* Step indicator */}
        <div className={styles.steps}>
          {STEPS.map((label, i) => (
            <div key={i} className={`${styles.step} ${i === step ? styles.stepActive : i < step ? styles.stepDone : ''}`}>
              <span className={styles.stepNum}>{i < step ? <IconCheck size={12} /> : i + 1}</span>
              <span className={styles.stepLabel}>{t(STEP_KEYS[i])}</span>
            </div>
          ))}
        </div>

        <div className={styles.body}>
          {/* Step 0: Select Provider */}
          {step === 0 && (
            <div className={styles.stepContent}>
              <p className={styles.stepDesc}>{t('install.chooseProviderHint')}</p>
              {loading && <div className={styles.loading}>{t('install.loadingProviders')}</div>}
              {!loading && providers.length === 0 && (
                <div className={styles.empty}>{t('install.noProvidersConfigured')}</div>
              )}
              <div className={styles.grid}>
                {providers.map((p) => (
                  <button
                    key={p.providerKey}
                    className={`${styles.pickCard} ${selectedProvider?.providerKey === p.providerKey ? styles.pickActive : ''}`}
                    onClick={() => { setSelectedProvider(p); setStep(1) }}
                  >
                    <span className={styles.pickLabel}>{p.label}</span>
                    <span className={styles.pickMeta}>{t('install.modelsCount', { count: p.modelCount })}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Select Tool */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <p className={styles.stepDesc}>
                {t('install.chooseToolHint', { provider: selectedProvider?.label || '' })}
              </p>
              <div className={styles.grid}>
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    className={`${styles.pickCard} ${selectedTool === tool.id ? styles.pickActive : ''}`}
                    onClick={() => { setSelectedTool(tool.id); setStep(2) }}
                  >
                    <span className={styles.pickEmoji}>{tool.emoji}</span>
                    <span className={styles.pickLabel}>{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Models */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <p className={styles.stepDesc}>
                {t('install.chooseModelsHint', { provider: selectedProvider?.label || '', tool: TOOLS.find(t => t.id === selectedTool)?.label || '' })}
              </p>
              <div className={styles.scopeToggle}>
                <button className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeActive : ''}`} onClick={() => { setScope('all'); selectAll() }}>{t('install.scope.all')}</button>
                <button className={`${styles.scopeBtn} ${scope === 'selected' ? styles.scopeActive : ''}`} onClick={() => setScope('selected')}>{t('install.selectModels')}</button>
              </div>
              {scope === 'selected' && (
                <div className={styles.modelGrid}>
                  {catalogModels.map((model) => (
                    <button
                      key={model.modelId}
                      className={`${styles.modelCard} ${selectedModels.includes(model.modelId) ? styles.modelSelected : ''}`}
                      onClick={() => toggleModel(model.modelId)}
                    >
                      <span className={styles.modelName}>{model.label}</span>
                      <span className={styles.modelTier}>{model.tier}</span>
                    </button>
                  ))}
                </div>
              )}
              {scope === 'all' && (
                <div className={styles.allNotice}>
                  {t('install.allModelsNotice', { count: catalogModels.length, provider: selectedProvider?.label || '' })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Installing → Done */}
          {step === 3 && (
            <div className={styles.stepContent}>
              {installing && (
                <div className={styles.installingState}>
                  <IconLoader size={32} className={styles.spinner} />
                  <span className={styles.installingLabel}>{t('install.installingCount', { count: scope === 'all' ? t('install.scope.all').toLowerCase() : selectedModels.length })}</span>
                  <span className={styles.installingSub}>{t('install.writingConfig', { tool: TOOLS.find(t => t.id === selectedTool)?.label || '' })}</span>
                </div>
              )}
              {!installing && installResult && (
                <div className={styles.doneState}>
                  <div className={styles.checkCircle}>
                    <IconCheck size={36} />
                  </div>
                  <h3 className={styles.doneTitle}>{t('install.installed')}</h3>
                  <p className={styles.doneSub}>
                    {installResult.modelCount} model{installResult.modelCount !== 1 ? 's' : ''} from <strong>{selectedProvider?.label}</strong> → <strong>{installResult.toolLabel}</strong>
                  </p>
                  <code className={styles.installPath}>{installResult.path}</code>
                </div>
              )}
              {!installing && !installResult && (
                <div className={styles.doneState}>
                  <span className={styles.errorDot}>✕</span>
                  <h3 className={styles.doneTitle}>{t('install.installFailed')}</h3>
                  <p className={styles.doneSub}>{t('install.retryHint')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className={styles.footer}>
          {step > 0 && step < 3 && (
            <button className={styles.backBtn} onClick={handleBack}>
              <IconChevronLeft size={14} />
              {t('common.back')}
            </button>
          )}
          {/* Step 3 error: show Back to retry */}
          {step === 3 && !installing && !installResult && (
            <button className={styles.backBtn} onClick={() => setStep(2)}>
              <IconChevronLeft size={14} />
              {t('common.back')}
            </button>
          )}
          {step < 3 && (
            <button className={styles.nextBtn} onClick={handleNext} disabled={!canNext()}>
              {step === 2 ? (
                <>
                  <IconPlug size={14} />
                  {t('install.install')}
                </>
              ) : (
                <>
                  {t('install.next')}
                  <IconChevronRight size={14} />
                </>
              )}
            </button>
          )}
          {step === 3 && !installing && installResult && (
            <button className={styles.doneBtn} onClick={onClose}>
              <IconCheck size={14} />
              {t('install.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
