import { useState } from "react"
import { AlertTriangle, Check, Copy, X } from "lucide-react"

type SecretRevealModalProps = {
  title: string
  secret: string
  onClose: () => void
}

function SecretRevealModal({ title, secret, onClose }: SecretRevealModalProps) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-button" type="button" aria-label="Close" onClick={onClose}>
            <X className="icon-sm" />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: "0 0 10px", fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
            Copy this key now — for security it will not be shown again.
          </p>
          <div className="secret-box">
            <code className="secret-value">{secret}</code>
            <button
              type="button"
              className={`secret-copy${copied ? " copied" : ""}`}
              onClick={copy}
            >
              {copied ? <Check className="icon-sm" /> : <Copy className="icon-sm" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="secret-warning">
            <AlertTriangle className="icon-sm" style={{ color: "#EE2B47", flexShrink: 0 }} />
            <span>
              Store it somewhere safe. It becomes usable at the gateway within ~5 seconds, and any
              previous key for this record stops working.
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="secret-copy"
            style={{ background: "var(--secondary)", color: "#34374C" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export { SecretRevealModal }
