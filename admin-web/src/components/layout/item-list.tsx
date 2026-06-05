import { Plus } from "lucide-react"

import { Item, ItemDetail, ItemEyebrow, ItemMeta, ItemTitle } from "@/components/ui/item"

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
            <Item
              key={item.id}
              aria-current={isSelected ? "true" : undefined}
              selected={isSelected}
              onClick={() => onSelect(item.id)}
            >
              <ItemTitle>{item.title}</ItemTitle>
              {item.eyebrow || item.meta ? (
                <ItemDetail>
                  {item.eyebrow ? <ItemEyebrow>{item.eyebrow}</ItemEyebrow> : null}
                  {item.meta ? <ItemMeta>{item.meta}</ItemMeta> : null}
                </ItemDetail>
              ) : null}
            </Item>
          )
        })}
      </div>
    </section>
  )
}

export { ItemList }
