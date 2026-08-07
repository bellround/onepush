import { createBoard } from '../game/board.ts'
import { ELEMENT_VALENCE } from '../game/elements.ts'
import type { ElementTile } from '../game/types.ts'
import type { LevelAtomDef, LevelDef } from './types.ts'

function tileFromDef(atom: LevelAtomDef): ElementTile {
  const valence = ELEMENT_VALENCE[atom.type]
  if (valence === undefined) {
    throw new Error(`${atom.type}: 알 수 없는 원소`)
  }
  return { id: atom.id, symbol: atom.type, valence, remaining: valence, row: atom.y, col: atom.x }
}

export function loadLevel(def: LevelDef) {
  const controlled = def.atoms.find((a) => a.controlled)
  if (!controlled) {
    throw new Error(`${def.id}: controlled 원자가 없음`)
  }

  const tiles = def.atoms.map(tileFromDef)
  const walls = (def.grid.walls ?? []).map(([x, y]) => ({ row: y, col: x }))
  const board = createBoard(def.grid.height, def.grid.width, tiles, controlled.id, walls)

  return { board, name: def.name, targetMolecule: def.targetMolecule, explanation: def.explanation }
}
