import {LexoRank} from 'lexorank'
import type {PatchOperations, SanityDocument} from 'sanity'
import {ORDER_FIELD_NAME} from './constants'

export interface MaifestArgs {
  entities: SanityDocument[]
  selectedItems: SanityDocument[]
  isMovingUp: boolean
  curIndex: number
  nextIndex: number
  prevIndex: number
}

export interface ReorderArgs {
  entities: SanityDocument[]
  selectedIds: string[]
  source: any
  destination: any
  debug?: boolean
}

function lexicographicalSort(a: {[ORDER_FIELD_NAME]: string}, b: {[ORDER_FIELD_NAME]: string}) {
  if (a[ORDER_FIELD_NAME] < b[ORDER_FIELD_NAME]) {
    return -1
  }
  if (a[ORDER_FIELD_NAME] > b[ORDER_FIELD_NAME]) {
    return 1
  }
  return 0
}

export const reorderDocuments = ({
  entities,
  selectedIds,
  source,
  destination,
  debug = false,
}: ReorderArgs) => {
  const startIndex = source.index
  const endIndex = destination.index
  const isMovingUp = startIndex > endIndex
  const selectedItems = entities.filter((item) => selectedIds.includes(item._id))
  const message = [
    `Moved`,
    selectedItems.length === 1 ? `1 Document` : `${selectedItems.length} Documents`,
    isMovingUp ? `up` : `down`,
    `from position`,
    `${startIndex + 1} to ${endIndex + 1}`,
  ].join(' ')

  const {all, selected} = entities.reduce(
    (acc, cur, curIndex) => {
      // Selected items get spread in below, so skip them here
      if (selectedIds.includes(cur._id)) {
        return {all: acc.all, selected: acc.selected}
      }

      // Drop seleced items in
      if (curIndex === endIndex) {
        const prevIndex = curIndex - 1
        const prevRank = entities[prevIndex]?.[ORDER_FIELD_NAME]
          ? LexoRank.parse(entities[prevIndex]?.[ORDER_FIELD_NAME] as string)
          : LexoRank.min()

        const curRank = LexoRank.parse(entities[curIndex][ORDER_FIELD_NAME] as string)

        const nextIndex = curIndex + 1
        const nextRank = entities[nextIndex]?.[ORDER_FIELD_NAME]
          ? LexoRank.parse(entities[nextIndex]?.[ORDER_FIELD_NAME] as string)
          : LexoRank.max()

        let betweenRank = isMovingUp ? prevRank.between(curRank) : curRank.between(nextRank)

        // For each selected item, assign a new orderRank between now and next
        for (let selectedIndex = 0; selectedIndex < selectedItems.length; selectedIndex += 1) {
          selectedItems[selectedIndex][ORDER_FIELD_NAME] = (betweenRank as any).value as string
          betweenRank = isMovingUp ? betweenRank.between(curRank) : betweenRank.between(nextRank)
        }

        return {
          // The `all` array gets sorted by order field later anyway
          // so that this probably isn't necessary ¯\_(ツ)_/¯
          all: isMovingUp
            ? [...acc.all, ...selectedItems, cur]
            : [...acc.all, cur, ...selectedItems],
          selected: selectedItems,
        }
      }

      return {all: [...acc.all, cur], selected: acc.selected}
    },
    {all: [] as SanityDocument[], selected: [] as SanityDocument[]}
  )

  const patches: [string, PatchOperations][] = selected.map((doc) => {
    return [
      doc._id,
      {
        set: {
          [ORDER_FIELD_NAME]: doc[ORDER_FIELD_NAME],
        },
      },
    ]
  })

  // Safety-check to make sure everything is in order
  const allSorted = (all as unknown as {[ORDER_FIELD_NAME]: string}[]).sort(lexicographicalSort)

  return {newOrder: allSorted, patches, message}
}
