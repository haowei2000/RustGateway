import { Plus } from "lucide-react"

export type ItemListItem = {
  eyebrow?: string
  id: string
  meta?: string
  title: string
}

type ItemListProps = {
  addLabel: string
  emptyText: string
  isAdding: boolean
  items: ItemListItem[]
  selectedItemId: string
  title: string
  onAdd: () => void
  onSelect: (id: string) => void
}

function ItemList({
  addLabel,
  emptyText,
  isAdding,
  items,
  selectedItemId,
  title,
  onAdd,
  onSelect,
}: ItemListProps) {
  return (
    <section className="item-list" aria-label={title}>
      <div className="item-list-header">
        <div className="item-list-title-group">
          <h2 className="item-list-title">{title}</h2>
        </div>
        <button
          aria-label={addLabel}
          className="item-list-add-button"
          disabled={isAdding}
          type="button"
          onClick={onAdd}
        >
          <Plus className="icon-sm" aria-hidden="true" />
          <span className="item-list-add-label">{addLabel}</span>
        </button>
      </div>

      <div className="item-list-body">
        {items.length === 0 ? <p className="item-list-empty">{emptyText}</p> : null}
        {items.map((item) => {
          const isSelected = selectedItemId === item.id

          return (
            <button
              key={item.id}
              aria-current={isSelected ? "true" : undefined}
              className={isSelected ? "item-list-row selected" : "item-list-row"}
              type="button"
              onClick={() => onSelect(item.id)}
            >
              <span className="item-list-row-title">{item.title}</span>
              {item.eyebrow || item.meta ? (
                <span className="item-list-row-detail">
                  {item.eyebrow ? (
                    <span className="item-list-row-eyebrow">{item.eyebrow}</span>
                  ) : null}
                  {item.meta ? <span className="item-list-row-meta">{item.meta}</span> : null}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export { ItemList }
