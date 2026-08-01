import './AvatarPicker.css'

export const CHILD_EMOJIS = ['🙂', '🦊', '🐼', '🦄', '🐸', '🐨', '🦁', '🐧', '🐙', '🦖', '🌟', '🚀']
export const CHILD_COLORS = [
  '#6d5ae0',
  '#e0679a',
  '#2fa87a',
  '#f7a93b',
  '#3d84d8',
  '#d9534f',
  '#8b5cf6',
  '#0ea5a4',
]

export const TASK_EMOJIS = [
  '✅', '🪥', '🛏️', '🎒', '📚', '🍎', '🚿', '🧦', '🧹', '🐕', '🎹', '⚽',
  '🏀', '🚲', '💧', '🧘', '🎨', '🧩', '🍽️', '🗑️', '⏰', '🌙',
]

export const REWARD_EMOJIS = ['🎁', '🍦', '🎬', '🎮', '🏊', '🍕', '🎡', '📱', '🧸', '🎟️']

export function EmojiPicker({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (emoji: string) => void
  options: string[]
  label: string
}) {
  return (
    <div className="picker" role="radiogroup" aria-label={label}>
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="radio"
          aria-checked={value === emoji}
          aria-label={emoji}
          className={`picker__emoji ${value === emoji ? 'is-active' : ''}`}
          onClick={() => onChange(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (color: string) => void
  label: string
}) {
  return (
    <div className="picker" role="radiogroup" aria-label={label}>
      {CHILD_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          className={`picker__color ${value === color ? 'is-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  )
}

export function Avatar({
  emoji,
  color,
  size = 'md',
}: {
  emoji: string
  color: string
  size?: 'md' | 'lg'
}) {
  return (
    <span
      className={`avatar ${size === 'lg' ? 'avatar--lg' : ''}`}
      style={{ background: color }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  )
}
