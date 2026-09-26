/**
 * @file web/src/components/launch/LaunchButton.jsx
 * @description Reusable M3 endpoint install action for table rows, DetailPanel, and Recommend results.
 * @functions LaunchButton → renders a plug button that installs the selected model endpoint
 * @exports LaunchButton
 */
import { IconPlugConnected } from '@tabler/icons-react'
import { getToolMeta } from '../../../../src/core/tool-metadata.js'
import { useI18n } from '../../i18n.jsx'
import styles from './LaunchButton.module.css'

export default function LaunchButton({ model, toolMode = 'opencode', onLaunch, variant = 'default', disabled = false }) {
  const { t } = useI18n()
  const meta = getToolMeta(toolMode)
  const toolLabel = `${meta.emoji} ${meta.label}`
  const label = variant === 'icon'
    ? t('dashboard.installEndpoint')
    : t('dashboard.installEndpointInTool', { tool: toolLabel })
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[variant] || ''}`}
      disabled={disabled || !model}
      onClick={(event) => {
        event.stopPropagation()
        if (model) onLaunch?.(model)
      }}
      title={model
        ? t('dashboard.installModelEndpoint', { model: model.label, tool: meta.label })
        : t('dashboard.selectModelFirst')}
      aria-label={model
        ? t('dashboard.installModelEndpoint', { model: model.label, tool: meta.label })
        : t('dashboard.installSelectedModelEndpoint')}
    >
      <IconPlugConnected size={variant === 'icon' ? 13 : 14} stroke={1.8} />
      {variant !== 'icon' && <span>{label}</span>}
    </button>
  )
}
