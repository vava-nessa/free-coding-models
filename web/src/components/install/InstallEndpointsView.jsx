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

const STEPS = ['Provider', 'Tool', 'Models', 'Install']

export default function InstallEndpointsView({ onClose, onToast }) {
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
        onToast?.(`Installed ${data.modelCount} models for ${selectedProvider.label} into ${TOOLS.find(t => t.id === selectedTool)?.label || selectedTool}.`, 'success')
      } else {
        setInstallResult(null)
        onToast?.(`Install failed: ${data.error || 'unknown'}`, 'error')
        // 📖 Retour au step 2 si l'install échoue pour laisser réessayer
        setStep(2)
      }
    } catch (err) {
      setInstallResult(null)
      onToast?.(`Install error: ${err.message}`, 'error')
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
            Install Endpoints
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Step indicator */}
        <div className={styles.steps}>
          {STEPS.map((label, i) => (
            <div key={i} className={`${styles.step} ${i === step ? styles.stepActive : i < step ? styles.stepDone : ''}`}>
              <span className={styles.stepNum}>{i < step ? <IconCheck size={12} /> : i + 1}</span>
              <span className={styles.stepLabel}>{label}</span>
            </div>
          ))}
        </div>

        <div className={styles.body}>
          {/* Step 0: Select Provider */}
          {step === 0 && (
            <div className={styles.stepContent}>
              <p className={styles.stepDesc}>Choose a provider with a configured API key.</p>
              {loading && <div className={styles.loading}>Loading providers…</div>}
              {!loading && providers.length === 0 && (
                <div className={styles.empty}>No configured providers found. Add API keys in Settings first.</div>
              )}
              <div className={styles.grid}>
                {providers.map((p) => (
                  <button
                    key={p.providerKey}
                    className={`${styles.pickCard} ${selectedProvider?.providerKey === p.providerKey ? styles.pickActive : ''}`}
                    onClick={() => { setSelectedProvider(p); setStep(1) }}
                  >
                    <span className={styles.pickLabel}>{p.label}</span>
                    <span className={styles.pickMeta}>{p.modelCount} models</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Select Tool */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <p className={styles.stepDesc}>
                Install <strong>{selectedProvider?.label}</strong> models into which tool?
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
                Choose models to install from <strong>{selectedProvider?.label}</strong> into <strong>{TOOLS.find(t => t.id === selectedTool)?.label}</strong>.
              </p>
              <div className={styles.scopeToggle}>
                <button className={`${styles.scopeBtn} ${scope === 'all' ? styles.scopeActive : ''}`} onClick={() => { setScope('all'); selectAll() }}>All Models</button>
                <button className={`${styles.scopeBtn} ${scope === 'selected' ? styles.scopeActive : ''}`} onClick={() => setScope('selected')}>Select Models</button>
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
                  All {catalogModels.length} models from {selectedProvider?.label} will be installed.
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
                  <span className={styles.installingLabel}>Installing {scope === 'all' ? 'all' : selectedModels.length} model{scope === 'all' && catalogModels.length !== 1 ? 's' : selectedModels.length !== 1 ? 's' : ''}…</span>
                  <span className={styles.installingSub}>Writing config for {TOOLS.find(t => t.id === selectedTool)?.label}</span>
                </div>
              )}
              {!installing && installResult && (
                <div className={styles.doneState}>
                  <div className={styles.checkCircle}>
                    <IconCheck size={36} />
                  </div>
                  <h3 className={styles.doneTitle}>Installed!</h3>
                  <p className={styles.doneSub}>
                    {installResult.modelCount} model{installResult.modelCount !== 1 ? 's' : ''} from <strong>{selectedProvider?.label}</strong> → <strong>{installResult.toolLabel}</strong>
                  </p>
                  <code className={styles.installPath}>{installResult.path}</code>
                </div>
              )}
              {!installing && !installResult && (
                <div className={styles.doneState}>
                  <span className={styles.errorDot}>✕</span>
                  <h3 className={styles.doneTitle}>Install failed</h3>
                  <p className={styles.doneSub}>Check the toast for details. You can go back and retry.</p>
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
              Back
            </button>
          )}
          {/* Step 3 error: show Back to retry */}
          {step === 3 && !installing && !installResult && (
            <button className={styles.backBtn} onClick={() => setStep(2)}>
              <IconChevronLeft size={14} />
              Back
            </button>
          )}
          {step < 3 && (
            <button className={styles.nextBtn} onClick={handleNext} disabled={!canNext()}>
              {step === 2 ? (
                <>
                  <IconPlug size={14} />
                  Install
                </>
              ) : (
                <>
                  Next
                  <IconChevronRight size={14} />
                </>
              )}
            </button>
          )}
          {step === 3 && !installing && installResult && (
            <button className={styles.doneBtn} onClick={onClose}>
              <IconCheck size={14} />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
