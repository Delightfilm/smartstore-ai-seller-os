// Research polling must not undo a newer manual save (or a newer job refresh).
export function mergeCandidateSnapshots(current,incoming) {
  const records=new Map(current.map(c=>[c.id,c]));
  for(const c of incoming){const old=records.get(c.id);if(!old||c.revision>=old.revision)records.set(c.id,c);}
  return [...records.values()];
}
