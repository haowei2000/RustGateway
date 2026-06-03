export function formatDate(value: string | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-"
}

export function formatNumber(value: number) {
  return value.toLocaleString()
}

export function getSelectedItem<T extends { id: string }>(items: T[], selectedItemId: string) {
  return items.find((item) => item.id === selectedItemId) ?? items[0]
}
