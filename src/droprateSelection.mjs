export function selectObservation(data, selection) {
  const pzk = selection.selected_pzk in data ? selection.selected_pzk : Object.keys(data)[0] ?? ''
  const items = data[pzk] ?? {}
  const ik = selection.selected_ik in items ? selection.selected_ik : Object.keys(items)[0] ?? ''
  const species = items[ik] ?? {}
  const specie = selection.selected_specie in species ? selection.selected_specie : Object.keys(species)[0] ?? ''
  return { selected_pzk: pzk, selected_ik: ik, selected_specie: specie }
}
