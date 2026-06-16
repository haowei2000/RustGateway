import { useState } from "react"
import { Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SelectableItem = {
  id: string
  label: string
  subtitle?: string
}

type AddItemModalProps = {
  confirmLabel?: string
  emptyText: string
  items: SelectableItem[]
  onClose: () => void
  onConfirm: (selectedIds: string[]) => void
  open: boolean
  title: string
}

function AddItemModal({
  confirmLabel = "Add selected",
  emptyText,
  items,
  onClose,
  onConfirm,
  open,
  title,
}: AddItemModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  if (!open) return null

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    if (selected.size === 0) return
    onConfirm(Array.from(selected))
    setSelected(new Set())
  }

  function handleClose() {
    setSelected(new Set())
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-button" type="button" onClick={handleClose}>
            <X className="icon-sm" />
          </button>
        </div>

        <div className="modal-body">
          {items.length === 0 ? (
            <p className="modal-empty">{emptyText}</p>
          ) : (
            items.map((item) => (
              <label key={item.id} className="modal-checkbox-row">
                <input
                  checked={selected.has(item.id)}
                  className="modal-checkbox"
                  type="checkbox"
                  onChange={() => toggle(item.id)}
                />
                <span className="modal-checkbox-label">
                  <span className="modal-checkbox-title">{item.label}</span>
                  {item.subtitle ? (
                    <span className="modal-checkbox-subtitle">{item.subtitle}</span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="modal-footer">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={selected.size === 0} onClick={handleConfirm}>
            <Plus className="icon-sm" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Input-based modal (for typing a single value) ──────────────────

type InputModalProps = {
  label: string
  onClose: () => void
  onConfirm: (value: string) => void
  open: boolean
  placeholder?: string
  title: string
}

function InputModal({
  label,
  onClose,
  onConfirm,
  open,
  placeholder,
  title,
}: InputModalProps) {
  const [value, setValue] = useState("")

  if (!open) return null

  function handleConfirm() {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    setValue("")
  }

  function handleClose() {
    setValue("")
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-button" type="button" onClick={handleClose}>
            <X className="icon-sm" />
          </button>
        </div>

        <div className="modal-body">
          <label className="modal-field">
            <span className="modal-field-label">{label}</span>
            <Input
              autoFocus
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirm() }}
            />
          </label>
        </div>

        <div className="modal-footer">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!value.trim()} onClick={handleConfirm}>
            <Plus className="icon-sm" />
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

export { AddItemModal, InputModal }
