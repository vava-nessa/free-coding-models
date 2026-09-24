/**
 * @file web/src/components/installed/InstalledModelsView.jsx
 * @description Installed Models modal — scans all tool configs, shows models, soft-delete.
 * 📖 M4: Full TUI parity for installed models management.
 */
import { useInstalledModels } from '../../hooks/useInstalledModels.js'
import { IconFolders, IconTrash, IconRefresh } from '@tabler/icons-react'
import styles from './InstalledModelsView.module.css'
import { useI18n } from '../../i18n.jsx'

export default function InstalledModelsView({ onClose, onToast }) {
  const { t } = useI18n()
  const { results, loading, refresh, disableModel } = useInstalledModels()

  const handleDisable = async (toolMode, modelId) => {
    try {
      const result = await disableModel(toolMode, modelId)
      if (result.success) {
        onToast?.(t('installed.disabled', { model: modelId, tool: toolMode }), 'success')
      } else {
        onToast?.(t('installed.failed', { error: result.error || t('common.unknown') }), 'error')
      }
    } catch (err) {
      onToast?.(t('installed.failed', { error: err.message }), 'error')
    }
  }

  const totalModels = results.reduce((sum, r) => sum + r.models.length, 0)

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <IconFolders size={20} stroke={1.5} />
            {t('installed.title')}
            {!loading && <span className={styles.count}>{totalModels}</span>}
          </h2>
          <div className={styles.headerActions}>
            <button className={styles.refreshBtn} onClick={refresh} title={t('installed.refresh')} aria-label={t('installed.refresh')}>
              <IconRefresh size={14} />
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.empty}>{t('installed.scanning')}</div>}

          {!loading && totalModels === 0 && (
            <div className={styles.empty}>
              {t('installed.noModels')}
              <br />
              <span className={styles.hint}>{t('installed.configureHint')}</span>
            </div>
          )}

          {!loading && results.map((tool) => (
            <div key={tool.toolMode} className={styles.toolGroup}>
              <div className={styles.toolHeader}>
                <span className={styles.toolEmoji}>{tool.toolEmoji}</span>
                <span className={styles.toolLabel}>{tool.toolLabel}</span>
                <span className={styles.toolCount}>{t('install.modelsCount', { count: tool.models.length })}</span>
                {!tool.isValid && <span className={styles.toolMissing}>{t('installed.notInstalled')}</span>}
              </div>
              {tool.models.length > 0 && (
                <div className={styles.modelList}>
                  {tool.models.map((model) => (
                    <div key={`${tool.toolMode}-${model.modelId}`} className={styles.modelRow}>
                      <span className={styles.modelIcon}>{model.isExternal ? '🔗' : '✅'}</span>
                      <span className={styles.modelName}>{model.label}</span>
                      {model.tier && model.tier !== '-' && <span className={styles.modelTier}>{model.tier}</span>}
                      <span className={styles.modelId} title={model.modelId}>{model.modelId}</span>
                      <button
                        className={styles.disableBtn}
                        onClick={() => handleDisable(tool.toolMode, model.modelId)}
                        title={t('installed.removeTitle')}
                      >
                        <IconTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
