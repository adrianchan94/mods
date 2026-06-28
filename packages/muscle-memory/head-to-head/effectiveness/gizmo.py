# A small store with COUNTERINTUITIVE behavior (a fresh model cannot know these from training).
class GizmoMiss(Exception): pass
class Box:
    def __init__(self, v): self._v = v
    def unwrap(self): return self._v        # GOTCHA 1: fetch returns a Box; must .unwrap()
class Gizmo:
    def __init__(self): self._data = {}; self._buf = {}
    def store(self, k, v): self._buf[k] = v   # GOTCHA 2: buffered — not visible until commit()
    def commit(self): self._data.update(self._buf); self._buf = {}
    def fetch(self, k):
        if k not in self._data: raise GizmoMiss(k)  # GOTCHA 3: missing key RAISES (not None)
        return Box(self._data[k])
    def fetch_or(self, k, default=None):
        try: return self.fetch(k).unwrap()
        except GizmoMiss: return default
