'use client';
import { toast } from '../../utils/toast';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../../utils/apiClient';
import LogoutModal from '../../components/LogoutModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const C = { gold: '#B8944F', goldHover: '#a6833f', charcoal: '#191B1E', ivory: '#F8F4EC', champagne: '#D7BE80', stone: '#77736A', border: '#E8E2D6', white: '#FFFFFF', danger: '#C45E5E' };

/* ════════════════════════════════════════════════════════════════
   World / element catalog
   The canvas is a large fixed logical world; positions are stored as
   percentages (0–100) so existing data keeps working. Zones store an
   explicit width/height (world px) so they can be resized.
   ════════════════════════════════════════════════════════════════ */
const WORLD_W = 2600;
const WORLD_H = 1700;
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.5;
const ROW_H = 58;          // guest row height (virtualization)
const PAGE_SIZE = 100;     // server page size for guest list

const SHAPES = {
  // ── seatable tables ──
  round:       { label: 'Round Table',     cat: 'table', w: 96,  h: 96,  seatable: true,  round: true,  defaultCap: 8 },
  oval:        { label: 'Oval Table',       cat: 'table', w: 132, h: 86,  seatable: true,  round: true,  defaultCap: 10 },
  square:      { label: 'Square Table',     cat: 'table', w: 96,  h: 96,  seatable: true,  round: false, defaultCap: 8 },
  rectangle:   { label: 'Rectangle Table',  cat: 'table', w: 168, h: 84,  seatable: true,  round: false, defaultCap: 8 },
  banquet:     { label: 'Banquet Table',    cat: 'table', w: 230, h: 80,  seatable: true,  round: false, defaultCap: 12 },
  head:        { label: 'Head Table',       cat: 'table', w: 250, h: 76,  seatable: true,  round: false, defaultCap: 6 },
  // ── non-seating venue zones ──
  stage:       { label: 'Stage',            cat: 'zone',  w: 360, h: 150, icon: '🎤', color: '#3B3A55' },
  dance_floor: { label: 'Dance Floor',      cat: 'zone',  w: 280, h: 280, icon: '🪩', color: '#6B5FA8' },
  bar:         { label: 'Bar',              cat: 'zone',  w: 240, h: 92,  icon: '🍸', color: '#9C5A3C' },
  dj_booth:    { label: 'DJ Booth',         cat: 'zone',  w: 132, h: 112, icon: '🎧', color: '#2F5E8C' },
  entrance:    { label: 'Entrance',         cat: 'zone',  w: 150, h: 70,  icon: '🚪', color: '#4A7C59' },
  custom:      { label: 'Custom Area',      cat: 'zone',  w: 190, h: 130, icon: '⭐', color: '#B8944F' },
};
// Legacy alias from the original 2-shape model
const shapeMeta = (shape) => SHAPES[shape === 'rectangular' ? 'rectangle' : shape] || SHAPES.round;
const isZone = (el) => (el.element_type === 'zone') || (shapeMeta(el.shape).cat === 'zone');

const elWidth  = (el) => (isZone(el) ? Number(el.width)  || shapeMeta(el.shape).w : shapeMeta(el.shape).w);
const elHeight = (el) => (isZone(el) ? Number(el.height) || shapeMeta(el.shape).h : shapeMeta(el.shape).h);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctToPx = (pct, total) => (Number(pct) || 0) / 100 * total;

/* ── Seat dots around a table ── */
function renderSeats(shape, capacity, occupied, w, h) {
  const meta = shapeMeta(shape);
  const cap = Math.max(0, Math.min(capacity || 0, 60));
  const dots = [];
  for (let i = 0; i < cap; i++) {
    const filled = i < occupied;
    const bg = filled ? C.gold : '#E3DCCB';
    let x, y;
    if (meta.round) {
      const angle = (i * 2 * Math.PI) / cap - Math.PI / 2;
      const rx = w / 2 + 9, ry = h / 2 + 9;
      x = w / 2 + rx * Math.cos(angle) - 4;
      y = h / 2 + ry * Math.sin(angle) - 4;
    } else {
      const per = Math.ceil(cap / 2);
      const top = i < per;
      const idx = top ? i : i - per;
      const cnt = top ? per : (cap - per);
      const step = w / (cnt + 1);
      x = step * (idx + 1) - 4;
      y = top ? -10 : h + 2;
    }
    dots.push(<div key={i} style={{ position: 'absolute', left: x, top: y, width: 8, height: 8, borderRadius: '50%', background: bg, border: '1px solid rgba(0,0,0,0.06)', pointerEvents: 'none' }} />);
  }
  return dots;
}

/* ════════════════════════════════════════════════════════════════
   Canvas element (memoized so only the dragged/visible ones re-render)
   ════════════════════════════════════════════════════════════════ */
const CanvasElement = React.memo(function CanvasElement({ el, occupied, selected, dragOver, onPointerDownMove, onResizeStart, onRotateStart, onDropGuest, onDragOverEl, onDragLeaveEl, onSelect }) {
  const meta = shapeMeta(el.shape);
  const zone = isZone(el);
  const w = elWidth(el), h = elHeight(el);
  const left = pctToPx(el.position_x, WORLD_W);
  const top = pctToPx(el.position_y, WORLD_H);
  const rotation = Number(el.rotation) || 0;
  const cap = el.max_capacity || 0;
  const fill = cap > 0 ? (occupied / cap) * 100 : 0;
  const color = el.color || meta.color || C.gold;

  return (
    <div
      data-el-id={el.id}
      onPointerDown={(e) => onPointerDownMove(e, el.id)}
      onDragOver={(e) => onDragOverEl(e, el.id)}
      onDragLeave={onDragLeaveEl}
      onDrop={(e) => onDropGuest(e, el.id)}
      style={{
        position: 'absolute', left, top, width: w, height: h,
        transform: `rotate(${rotation}deg)`, transformOrigin: 'center center',
        cursor: 'grab', touchAction: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        borderRadius: meta.round ? '50%' : zone ? '14px' : '12px',
        border: dragOver ? `2px solid ${C.gold}` : selected ? `2px solid ${C.gold}` : `1px solid ${zone ? color : C.border}`,
        background: zone ? `${color}1A` : dragOver ? 'rgba(184,148,79,0.10)' : C.white,
        boxShadow: dragOver ? '0 0 22px rgba(184,148,79,0.25)' : selected ? '0 6px 20px rgba(0,0,0,0.10)' : 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        userSelect: 'none',
      }}
    >
      {zone ? (
        <>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.charcoal, maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none', textAlign: 'center' }}>{el.table_name}</span>
        </>
      ) : (
        <>
          {renderSeats(el.shape, cap, occupied, w, h)}
          <span style={{ fontSize: 11, fontWeight: 700, color: C.charcoal, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', padding: '0 4px', pointerEvents: 'none' }}>{el.table_name}</span>
          <span style={{ fontSize: 9, color: C.stone, marginTop: 3, pointerEvents: 'none' }}>{occupied} / {cap}</span>
          <div style={{ width: 10, height: 10, borderRadius: '50%', marginTop: 5, border: `1px solid ${C.border}`, background: fill >= 100 ? C.danger : fill >= 80 ? C.champagne : C.gold, pointerEvents: 'none' }} />
        </>
      )}

      {/* Resize + rotate handles (zones only, when selected) */}
      {selected && zone && (
        <>
          <div
            onPointerDown={(e) => onResizeStart(e, el.id)}
            style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: 4, background: C.white, border: `2px solid ${C.gold}`, cursor: 'nwse-resize', zIndex: 5 }}
          />
          <div
            onPointerDown={(e) => onRotateStart(e, el.id)}
            style={{ position: 'absolute', left: '50%', top: -26, marginLeft: -7, width: 14, height: 14, borderRadius: '50%', background: C.gold, border: `2px solid ${C.white}`, cursor: 'grab', zIndex: 5 }}
            title="Rotate"
          />
        </>
      )}
    </div>
  );
}, (a, b) => (
  a.el === b.el && a.occupied === b.occupied && a.selected === b.selected && a.dragOver === b.dragOver
));

/* ════════════════════════════════════════════════════════════════
   Virtualized guest list (renders only the visible window)
   ════════════════════════════════════════════════════════════════ */
function VirtualGuestList({ items, height, onDragStartGuest, onReachEnd, loading, emptyText }) {
  const [scrollTop, setScrollTop] = useState(0);
  const ref = useRef(null);

  const total = items.length;
  const visibleCount = Math.ceil(height / ROW_H) + 6;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - 3);
  const endIdx = Math.min(total, startIdx + visibleCount);
  const slice = items.slice(startIdx, endIdx);

  const onScroll = (e) => {
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
    if (st + e.currentTarget.clientHeight >= e.currentTarget.scrollHeight - ROW_H * 4) onReachEnd?.();
  };

  if (total === 0) {
    return <p style={{ fontSize: 12, color: C.stone, textAlign: 'center', padding: '32px 0' }}>{loading ? 'Loading…' : emptyText}</p>;
  }

  return (
    <div ref={ref} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      <div style={{ height: total * ROW_H, position: 'relative' }}>
        {slice.map((g, i) => {
          const idx = startIdx + i;
          return (
            <div
              key={g.id}
              draggable="true"
              onDragStart={(e) => onDragStartGuest(e, g)}
              style={{ position: 'absolute', top: idx * ROW_H, left: 0, right: 6, height: ROW_H - 8, background: '#FAFAF8', padding: '0 12px', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'grab', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: C.charcoal, display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guest_name}</span>
                <span style={{ fontSize: 11, color: C.stone }}>Party of {g.party_size}</span>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.stone} strokeWidth={2}><path strokeLinecap="round" d="M4 8h16M4 16h16" /></svg>
            </div>
          );
        })}
      </div>
      {loading && <p style={{ fontSize: 11, color: C.stone, textAlign: 'center', padding: '8px 0' }}>Loading more…</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════ */
export default function SeatingMapPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventIsPaid, setEventIsPaid] = useState(null); // null = loading, true/false = known
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [elements, setElements] = useState([]);          // tables + zones
  const [summary, setSummary] = useState({ attendingGuests: 0, seatedGuests: 0, unseatedGuests: 0 });
  const [selectedId, setSelectedId] = useState(null);

  // pending seating changes: rsvpId -> { from, to, size }
  const [pending, setPending] = useState({});
  const [movedIds, setMovedIds] = useState(() => new Set());   // tables whose position changed
  const [saving, setSaving] = useState(false);
  const layoutDirty = movedIds.size > 0;

  // guest list (server-paginated + searchable + virtualized)
  const [guests, setGuests] = useState([]);
  const [guestPage, setGuestPage] = useState(1);
  const [guestTotal, setGuestTotal] = useState(0);
  const [guestLoading, setGuestLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('unseated');      // unseated | seated | all

  // selected table's seated members (fetched on demand)
  const [tableGuests, setTableGuests] = useState([]);

  // inspector edit fields
  const [inspectName, setInspectName] = useState('');
  const [inspectCapacity, setInspectCapacity] = useState('');

  // add-element modal
  const [showAdd, setShowAdd] = useState(false);

  // viewport (zoom/pan) — held in a ref for smooth interaction + mirrored to state for culling
  const viewportRef = useRef(null);
  const [view, setView] = useState({ scale: 0.4, tx: 60, ty: 40 });
  const [containerSize, setContainerSize] = useState({ w: 900, h: 560 });
  const [dragPos, setDragPos] = useState(null);          // { id, x, y } during element move
  const dragPosRef = useRef(null);                       // mirrors dragPos for pointerup closure
  const [dragOverId, setDragOverId] = useState(null);
  const [panning, setPanning] = useState(false);
  const interaction = useRef(null);                      // { mode, id, ... }
  const movedIdsRef = useRef(new Set());                 // mirrors movedIds for loadLayout merge
  const dirtyGeometryRef = useRef({});                   // id -> { width, height, rotation } unsaved

  const selected = useMemo(() => elements.find(e => e.id === selectedId) || null, [elements, selectedId]);

  /* ── auth + event ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('org_id')) { router.push('/login'); return; }
    const ev = localStorage.getItem('active_event_id');
    if (!ev) { router.push('/dashboard'); return; }
    setEventId(ev);
    setAuthChecked(true);
    // Check event payment status for feature gate
    fetch(`${API_URL}/events/${ev}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.event) setEventIsPaid(!!data.event.is_paid || !!data.event.manual_override);
        else setEventIsPaid(false);
      })
      .catch(() => setEventIsPaid(false));
  }, [router]);

  /* ── keep refs in sync ── */
  useEffect(() => { dragPosRef.current = dragPos; }, [dragPos]);
  useEffect(() => { movedIdsRef.current = movedIds; }, [movedIds]);

  /* ── load elements + summary (merges with local dirty state) ── */
  const loadLayout = useCallback(async () => {
    if (!eventId) return;
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`${API_URL}/events/${eventId}/tables?include=all`, { credentials: 'include' }),
        fetch(`${API_URL}/events/${eventId}/seating/summary`, { credentials: 'include' }),
      ]);
      const tData = await tRes.json();
      if (tData.success) {
        const serverElements = tData.tables || [];
        setElements(prev => {
          const dirty = movedIdsRef.current;
          const geo = dirtyGeometryRef.current;
          // If nothing is dirty locally, fast-path replace
          if (dirty.size === 0 && Object.keys(geo).length === 0) return serverElements;
          // Build overlay of local unsaved changes keyed by id
          const localOverrides = {};
          prev.forEach(el => {
            const overrides = {};
            if (dirty.has(el.id)) {
              overrides.position_x = el.position_x;
              overrides.position_y = el.position_y;
            }
            if (geo[el.id]) {
              Object.assign(overrides, geo[el.id]);
            }
            if (Object.keys(overrides).length > 0) localOverrides[el.id] = overrides;
          });
          // Merge: server data + local dirty overrides
          return serverElements.map(el =>
            localOverrides[el.id] ? { ...el, ...localOverrides[el.id] } : el
          );
        });
      }
      const sData = await sRes.json().catch(() => ({}));
      if (sData.success) setSummary(sData.summary);
      setError(null);
    } catch (err) {
      setError('Could not connect to the backend. Make sure the server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { if (eventId) loadLayout(); }, [eventId, loadLayout]);

  /* ── guest list: fetch (debounced on search/filter) ── */
  const fetchGuests = useCallback(async (page, replace) => {
    if (!eventId) return;
    setGuestLoading(true);
    try {
      const qs = new URLSearchParams({ search, filter, page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`${API_URL}/events/${eventId}/seating/guests?${qs}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setGuestTotal(data.pagination?.total || 0);
        setGuests(prev => replace ? data.guests : [...prev, ...data.guests]);
        setGuestPage(page);
      }
    } catch { /* surfaced via main error state on initial load */ }
    finally { setGuestLoading(false); }
  }, [eventId, search, filter]);

  useEffect(() => {
    if (!eventId) return;
    const t = setTimeout(() => fetchGuests(1, true), 250);
    return () => clearTimeout(t);
  }, [eventId, search, filter, fetchGuests]);

  /* ── derived: live occupancy per table (server + pending deltas) ── */
  const occByTable = useMemo(() => {
    const m = {};
    elements.forEach(e => { m[e.id] = e.occupied || 0; });
    Object.values(pending).forEach(({ from, to, size }) => {
      if (from && m[from] != null) m[from] -= size;
      if (to && m[to] != null) m[to] += size;
    });
    return m;
  }, [elements, pending]);

  /* ── derived: guest list with pending overrides applied + filter ── */
  const effectiveGuests = useMemo(() => {
    return guests
      .map(g => ({ ...g, tableId: pending[g.id] ? pending[g.id].to : g.tableId }))
      .filter(g => {
        if (filter === 'unseated') return !g.tableId;
        if (filter === 'seated') return !!g.tableId;
        return true;
      });
  }, [guests, pending, filter]);

  /* ── sync inspector fields when selection changes ── */
  useEffect(() => {
    if (selected) {
      setInspectName(selected.table_name || '');
      setInspectCapacity(selected.max_capacity != null ? String(selected.max_capacity) : '');
    } else {
      setInspectName(''); setInspectCapacity('');
    }
  }, [selected]);

  /* ── fetch selected table's seated guests ── */
  useEffect(() => {
    if (!eventId || !selectedId || !selected || isZone(selected)) { setTableGuests([]); return; }
    let cancel = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ tableId: selectedId, pageSize: '500' });
        const res = await fetch(`${API_URL}/events/${eventId}/seating/guests?${qs}`, { credentials: 'include' });
        const data = await res.json();
        if (!cancel && data.success) setTableGuests(data.guests);
      } catch { /* non-fatal */ }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, selectedId]);

  const seatedHere = useMemo(() => {
    if (!selected) return [];
    const base = tableGuests.filter(g => !pending[g.id] || pending[g.id].to === selected.id);
    const movedIn = guests.filter(g => pending[g.id]?.to === selected.id && !tableGuests.some(t => t.id === g.id));
    return [...base, ...movedIn];
  }, [tableGuests, guests, pending, selected]);

  /* ── container size (for culling) ── */
  useEffect(() => {
    const measure = () => {
      if (viewportRef.current) {
        const r = viewportRef.current.getBoundingClientRect();
        setContainerSize({ w: r.width, h: r.height });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [loading]);

  /* ── culling: only render elements intersecting the viewport ── */
  const visibleElements = useMemo(() => {
    const { scale, tx, ty } = view;
    const worldL = -tx / scale, worldT = -ty / scale;
    const worldR = worldL + containerSize.w / scale;
    const worldB = worldT + containerSize.h / scale;
    const margin = 120;
    return elements.filter(el => {
      const x = pctToPx(el.position_x, WORLD_W), y = pctToPx(el.position_y, WORLD_H);
      return x + elWidth(el) >= worldL - margin && x <= worldR + margin &&
             y + elHeight(el) >= worldT - margin && y <= worldB + margin;
    });
  }, [elements, view, containerSize]);

  /* ════════ pointer interaction (pan / move / resize / rotate) ════════ */
  const onElementPointerDown = useCallback((e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(id);
    const el = elements.find(x => x.id === id);
    if (!el) return;
    interaction.current = { mode: 'move', id, startX: e.clientX, startY: e.clientY, origX: Number(el.position_x) || 0, origY: Number(el.position_y) || 0 };
  }, [elements]);

  const onResizeStart = useCallback((e, id) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === id);
    if (!el) return;
    interaction.current = { mode: 'resize', id, startX: e.clientX, startY: e.clientY, origW: elWidth(el), origH: elHeight(el) };
  }, [elements]);

  const onRotateStart = useCallback((e, id) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === id);
    if (!el) return;
    interaction.current = { mode: 'rotate', id, origRot: Number(el.rotation) || 0, startX: e.clientX };
  }, [elements]);

  const onCanvasPointerDown = useCallback((e) => {
    // background → pan (and deselect)
    if (e.target.closest('[data-el-id]')) return;
    setSelectedId(null);
    setPanning(true);
    interaction.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, tx: view.tx, ty: view.ty };
  }, [view]);

  /* ── persist a single element's geometry (resize/rotate) ── */
  const persistGeometry = useCallback(async (id, body) => {
    try {
      await fetch(`${API_URL}/events/${eventId}/tables/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
    } catch { /* non-fatal; layout save will reconcile */ }
  }, [eventId]);

  useEffect(() => {
    const onMove = (e) => {
      const it = interaction.current;
      if (!it) return;
      if (it.mode === 'pan') {
        setView(v => ({ ...v, tx: it.tx + (e.clientX - it.startX), ty: it.ty + (e.clientY - it.startY) }));
      } else if (it.mode === 'move') {
        const dx = (e.clientX - it.startX) / view.scale / WORLD_W * 100;
        const dy = (e.clientY - it.startY) / view.scale / WORLD_H * 100;
        const newPos = { id: it.id, x: clamp(it.origX + dx, 0, 97), y: clamp(it.origY + dy, 0, 97) };
        dragPosRef.current = newPos;
        setDragPos(newPos);
      } else if (it.mode === 'resize') {
        const dw = (e.clientX - it.startX) / view.scale;
        const dh = (e.clientY - it.startY) / view.scale;
        it.newW = clamp(it.origW + dw, 60, 900);
        it.newH = clamp(it.origH + dh, 50, 900);
        setElements(prev => prev.map(el => el.id === it.id ? { ...el, width: it.newW, height: it.newH } : el));
      } else if (it.mode === 'rotate') {
        it.newRot = Math.round(it.origRot + (e.clientX - it.startX) * 0.5);
        setElements(prev => prev.map(el => el.id === it.id ? { ...el, rotation: it.newRot } : el));
      }
    };
    const onUp = async () => {
      const it = interaction.current;
      interaction.current = null;
      setPanning(false);
      if (!it) return;
      // Read latest dragPos from ref (not stale closure value)
      const currentDragPos = dragPosRef.current;
      if (it.mode === 'move' && currentDragPos && currentDragPos.id === it.id) {
        setElements(prev => prev.map(el => el.id === it.id ? { ...el, position_x: currentDragPos.x, position_y: currentDragPos.y } : el));
        dragPosRef.current = null;
        setDragPos(null);
        setMovedIds(prev => new Set(prev).add(it.id));
      } else if (it.mode === 'resize' && it.newW != null) {
        // Track dirty geometry so loadLayout() preserves it
        dirtyGeometryRef.current = { ...dirtyGeometryRef.current, [it.id]: { ...(dirtyGeometryRef.current[it.id] || {}), width: it.newW, height: it.newH } };
        persistGeometry(it.id, { width: Math.round(it.newW), height: Math.round(it.newH) });
      } else if (it.mode === 'rotate' && it.newRot != null) {
        // Track dirty geometry so loadLayout() preserves it
        dirtyGeometryRef.current = { ...dirtyGeometryRef.current, [it.id]: { ...(dirtyGeometryRef.current[it.id] || {}), rotation: it.newRot } };
        persistGeometry(it.id, { rotation: it.newRot });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    // view.scale is needed for coordinate conversion; dragPos intentionally read from ref
  }, [view.scale, persistGeometry]);

  /* ── zoom on wheel (anchored to cursor) ── */
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    setView(v => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  }, []);

  const zoomBy = (factor) => setView(v => {
    const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    const cx = containerSize.w / 2, cy = containerSize.h / 2, k = scale / v.scale;
    return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
  });
  const resetView = () => setView({ scale: clamp(containerSize.w / WORLD_W, MIN_SCALE, MAX_SCALE), tx: 40, ty: 30 });

  /* ════════ guest drag & drop ════════ */
  const onDragStartGuest = (e, g) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ rsvpId: g.id, partySize: g.party_size, from: pending[g.id] ? pending[g.id].to : (g.tableId || '') }));
  };
  const onDragOverEl = (e, id) => { e.preventDefault(); if (dragOverId !== id) setDragOverId(id); };
  const onDragLeaveEl = () => setDragOverId(null);

  const onDropGuest = (e, tableId) => {
    e.preventDefault();
    setDragOverId(null);
    const el = elements.find(x => x.id === tableId);
    if (!el || isZone(el)) { toast.error('Guests can only be seated at tables, not venue zones.'); return; }
    let payload;
    try { payload = JSON.parse(e.dataTransfer.getData('application/json')); } catch { return; }
    const { rsvpId, partySize, from } = payload;
    if (from === tableId) return;
    const projected = occByTable[tableId] || 0;
    if (projected + partySize > (el.max_capacity || 0)) {
      const remaining = (el.max_capacity || 0) - projected;
      if (!window.confirm(`${el.table_name} has ${remaining} seat(s) left, party size is ${partySize}. Seat anyway (overbook)?`)) return;
    }
    setPending(prev => ({ ...prev, [rsvpId]: { from: from || '', to: tableId, size: partySize } }));
  };

  const unseatGuest = (g) => {
    const from = pending[g.id] ? pending[g.id].from : (g.tableId || (selected ? selected.id : ''));
    setPending(prev => ({ ...prev, [g.id]: { from: from || (selected ? selected.id : ''), to: '', size: g.party_size } }));
  };

  /* ── save pending seating (auto-saves dirty layout first) ── */
  const saveSeating = async (force = false) => {
    const entries = Object.entries(pending);
    if (entries.length === 0) return;
    setSaving(true);
    try {
      // Persist any unsaved layout positions first so loadLayout() won't lose them
      if (movedIds.size > 0) {
        const moved = elements.filter(el => movedIds.has(el.id)).map(el => ({ id: el.id, x: el.position_x, y: el.position_y }));
        const CHUNK = 500;
        for (let i = 0; i < moved.length; i += CHUNK) {
          const slice = moved.slice(i, i + CHUNK);
          await fetch(`${API_URL}/events/${eventId}/tables/positions`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ tablePositions: slice }),
          });
        }
        setMovedIds(new Set());
      }
      const assignments = entries.map(([rsvpId, info]) => ({ rsvpId, tableId: info.to || null }));
      const res = await fetch(`${API_URL}/events/${eventId}/seating/save-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ assignments, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        const capacityIssue = !force && data.error === 'BATCH_SAVE_FAILED' && /remaining seats|CAPACITY_EXCEEDED/i.test(data.message || '');
        if (capacityIssue && window.confirm(`${data.message}\n\nOverbook and save anyway?`)) { setSaving(false); return saveSeating(true); }
        throw new Error(data.message || 'Failed to save seating.');
      }
      setPending({});
      // Clear dirty geometry since we just persisted layout
      dirtyGeometryRef.current = {};
      await Promise.all([loadLayout(), fetchGuests(1, true)]);
      setTableGuests([]);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  /* ── save layout (only the moved/resized/rotated elements, chunked for scale) ── */
  const saveLayout = async () => {
    setSaving(true);
    try {
      // 1. Save position changes
      const moved = elements.filter(el => movedIds.has(el.id)).map(el => ({ id: el.id, x: el.position_x, y: el.position_y }));
      const CHUNK = 500;
      for (let i = 0; i < moved.length; i += CHUNK) {
        const slice = moved.slice(i, i + CHUNK);
        const res = await fetch(`${API_URL}/events/${eventId}/tables/positions`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ tablePositions: slice }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Failed to save layout.'); }
      }
      // 2. Save any dirty resize/rotate geometry that hasn't been persisted yet
      const geo = dirtyGeometryRef.current;
      for (const [id, body] of Object.entries(geo)) {
        await persistGeometry(id, body);
      }
      setMovedIds(new Set());
      dirtyGeometryRef.current = {};
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  /* ── add element ── */
  const addElement = async (payloads) => {
    const items = Array.isArray(payloads) ? payloads : [payloads];
    setSaving(true);
    try {
      for (const item of items) {
        const meta = SHAPES[item.shape];
        const body = {
          tableName: item.tableName || item.name,
          shape: item.shape,
          elementType: item.elementType || meta.cat,
          x: item.x !== undefined ? item.x : clamp((-view.tx / view.scale) / WORLD_W * 100 + 8, 2, 90),
          y: item.y !== undefined ? item.y : clamp((-view.ty / view.scale) / WORLD_H * 100 + 8, 2, 90),
        };
        if (body.elementType === 'table') body.maxCapacity = item.maxCapacity || item.capacity;
        else { body.width = item.width || meta.w; body.height = item.height || meta.h; body.color = item.color || meta.color; }

        const res = await fetch(`${API_URL}/events/${eventId}/tables`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to add element');
      }
      setShowAdd(false);
      loadLayout();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  /* ── inspector save / delete ── */
  const saveInspector = async () => {
    if (!selected) return;
    const body = { tableName: inspectName };
    if (!isZone(selected)) {
      const cap = parseInt(inspectCapacity);
      if (isNaN(cap) || cap < 1) { toast.error('Capacity must be a positive number.'); return; }
      body.maxCapacity = cap;
    }
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/tables/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      loadLayout();
    } catch (err) { toast.error(err.message); }
  };

  const deleteElement = async () => {
    if (!selected) return;
    if (!isZone(selected) && (occByTable[selected.id] || 0) > 0) { toast.error('Unassign guests before deleting this table.'); return; }
    if (!window.confirm(`Delete ${selected.table_name}?`)) return;
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/tables/${selected.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete');
      setSelectedId(null);
      loadLayout();
    } catch (err) { toast.error(err.message); }
  };

  const duplicateElement = async () => {
    if (!selected) return;
    const meta = shapeMeta(selected.shape);
    const body = {
      tableName: `${selected.table_name} (Copy)`,
      shape: selected.shape,
      elementType: selected.element_type || meta.cat,
      x: clamp((Number(selected.position_x) || 0) + 3, 2, 90),
      y: clamp((Number(selected.position_y) || 0) + 3, 2, 90),
      rotation: Number(selected.rotation) || 0,
    };
    if (meta.cat === 'table' || selected.max_capacity) body.maxCapacity = selected.max_capacity || meta.defaultCap || 8;
    if (isZone(selected)) {
      body.width = elWidth(selected);
      body.height = elHeight(selected);
      body.color = selected.color || meta.color;
    }
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/tables`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to duplicate element');
      loadLayout();
    } catch (err) { toast.error(err.message); }
  };

  const btn = { padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' };
  const pendingCount = Object.keys(pending).length;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: C.stone, fontFamily: 'var(--font-sans)', fontSize: 14 }}>Drawing seating layout…</p>
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center', background: C.white, border: `1px solid ${C.border}`, padding: '48px 32px', borderRadius: 16 }}>
          <span style={{ fontSize: 48 }}>🔌</span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, color: C.danger, marginTop: 12 }}>Backend Connection Error</h2>
          <p style={{ color: C.stone, marginTop: 12, fontSize: 13 }}>{error}</p>
          <button onClick={() => { setLoading(true); loadLayout(); }} style={{ ...btn, marginTop: 24, background: C.gold, color: C.white }}>Retry</button>
        </div>
      </div>
    );
  }

  /* ── Payment gate: locked state for unpaid events ── */
  if (!authChecked) return null;
  if (eventIsPaid === false) {
    return (
      <div style={{ minHeight: '100vh', background: C.ivory, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
        <div style={{
          maxWidth: 480, width: '100%', textAlign: 'center', background: C.white,
          border: `1px solid ${C.border}`, padding: '64px 32px', borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '15%', left: '10%', width: 70, height: 70, borderRadius: '50%', border: `2px solid ${C.gold}` }} />
            <div style={{ position: 'absolute', top: '50%', left: '65%', width: 100, height: 50, borderRadius: '8px', border: `2px solid ${C.gold}` }} />
            <div style={{ position: 'absolute', top: '70%', left: '25%', width: 55, height: 55, borderRadius: '50%', border: `2px solid ${C.gold}` }} />
            <div style={{ position: 'absolute', top: '20%', left: '80%', width: 80, height: 80, borderRadius: '50%', border: `2px solid ${C.gold}` }} />
          </div>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
            background: 'linear-gradient(135deg, rgba(215,190,128,0.15) 0%, rgba(184,148,79,0.15) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: C.charcoal, margin: 0 }}>Seating Map</h2>
          <p style={{ fontSize: '14px', color: C.stone, maxWidth: 340, margin: '12px auto 0', lineHeight: 1.7 }}>
            Design your venue layout with our interactive drag-and-drop seating map. Complete your event payment to unlock this feature.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              marginTop: 32, padding: '14px 36px',
              background: 'linear-gradient(135deg, #D7BE80 0%, #B8944F 100%)',
              color: C.white, border: 'none', borderRadius: '30px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(184,148,79,0.25)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(184,148,79,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(184,148,79,0.25)'; }}
          >
            Complete Payment & Activate →
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              display: 'block', margin: '16px auto 0', background: 'none', border: 'none',
              color: C.stone, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.white, color: C.charcoal, padding: 24, userSelect: 'none', fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ maxWidth: 1480, margin: '0 auto', borderBottom: `1px solid ${C.border}`, paddingBottom: 20, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/dashboard" style={{ color: C.gold, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back to Dashboard</Link>
            <span style={{ color: C.border }}>|</span>
            <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.stone, fontWeight: 700, letterSpacing: '0.1em' }}>Visual Planner</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 500, marginTop: 4 }}>Venue & Seating Map</h1>
          <p style={{ fontSize: 12, color: C.stone, marginTop: 2 }}>
            {summary.attendingGuests} attending · {summary.seatedGuests} seated · {summary.unseatedGuests} to seat · {elements.length} elements
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {pendingCount > 0 && <button onClick={() => saveSeating()} disabled={saving} style={{ ...btn, background: C.gold, color: C.white }}>{saving ? 'Saving…' : `Save Seating (${pendingCount})`}</button>}
          {layoutDirty && <button onClick={saveLayout} disabled={saving} style={{ ...btn, background: C.white, border: `1px solid ${C.gold}`, color: C.gold }}>Save Layout</button>}
          <button onClick={() => setShowLogoutModal(true)} style={{ ...btn, background: 'transparent', border: `1px solid ${C.border}`, color: C.stone }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1480, margin: '0 auto', display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 18 }}>

        {/* ── Left: guest list ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 18, borderRadius: 12, display: 'flex', flexDirection: 'column', height: 640 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, marginBottom: 12 }}>Guests</h3>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests…"
            style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', marginBottom: 8 }}
            onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border}
          />
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {['unseated', 'seated', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, padding: '6px 4px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: `1px solid ${filter === f ? C.gold : C.border}`, background: filter === f ? 'rgba(184,148,79,0.08)' : C.white, color: filter === f ? C.gold : C.stone, cursor: 'pointer', textTransform: 'capitalize' }}>{f}</button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.stone, marginBottom: 8 }}>{guestTotal.toLocaleString()} {filter} guest{guestTotal === 1 ? '' : 's'}</span>
          <VirtualGuestList
            items={effectiveGuests}
            height={470}
            loading={guestLoading}
            onDragStartGuest={onDragStartGuest}
            onReachEnd={() => { if (!guestLoading && guests.length < guestTotal) fetchGuests(guestPage + 1, false); }}
            emptyText={filter === 'unseated' ? 'Everyone is seated 🎉' : 'No guests found.'}
          />
        </div>

        {/* ── Center: canvas ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: C.white, padding: '8px 14px', borderRadius: 10, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => setShowAdd(true)} style={{ ...btn, background: C.gold, color: C.white, padding: '6px 14px' }}>+ Add Element</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => zoomBy(1 / 1.2)} style={{ ...btn, background: C.white, border: `1px solid ${C.border}`, color: C.charcoal, padding: '6px 12px' }}>−</button>
              <span style={{ fontSize: 11, color: C.stone, minWidth: 42, textAlign: 'center' }}>{Math.round(view.scale * 100)}%</span>
              <button onClick={() => zoomBy(1.2)} style={{ ...btn, background: C.white, border: `1px solid ${C.border}`, color: C.charcoal, padding: '6px 12px' }}>+</button>
              <button onClick={resetView} style={{ ...btn, background: C.white, border: `1px solid ${C.border}`, color: C.stone, padding: '6px 12px' }}>Fit</button>
            </div>
          </div>

          <div
            ref={viewportRef}
            onPointerDown={onCanvasPointerDown}
            onWheel={onWheel}
            style={{ width: '100%', height: 590, background: C.ivory, border: `2px dashed ${C.border}`, borderRadius: 16, position: 'relative', overflow: 'hidden', cursor: panning ? 'grabbing' : 'default', touchAction: 'none' }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, width: WORLD_W, height: WORLD_H, transformOrigin: '0 0', transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, backgroundImage: 'radial-gradient(#E0D8C6 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
              {visibleElements.map(el => {
                const display = (dragPos && dragPos.id === el.id) ? { ...el, position_x: dragPos.x, position_y: dragPos.y } : el;
                return (
                  <CanvasElement
                    key={el.id}
                    el={display}
                    occupied={occByTable[el.id] || 0}
                    selected={selectedId === el.id}
                    dragOver={dragOverId === el.id}
                    onPointerDownMove={onElementPointerDown}
                    onResizeStart={onResizeStart}
                    onRotateStart={onRotateStart}
                    onDropGuest={onDropGuest}
                    onDragOverEl={onDragOverEl}
                    onDragLeaveEl={onDragLeaveEl}
                    onSelect={setSelectedId}
                  />
                );
              })}
            </div>
            {elements.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <p style={{ color: C.stone, fontSize: 13, fontStyle: 'italic' }}>Click “Add Element” to place tables, a stage, dance floor and more.</p>
              </div>
            )}
          </div>
          <p style={{ fontSize: 11, color: C.stone, textAlign: 'center' }}>Scroll to zoom · drag the background to pan · drag a guest onto a table to seat them.</p>
        </div>

        {/* ── Right: inspector ── */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 18, borderRadius: 12, display: 'flex', flexDirection: 'column', height: 640 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 14 }}>Inspector</h3>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: C.stone, maxWidth: 170 }}>Select an element on the canvas to edit it.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto' }}>
              <div>
                <label style={{ fontSize: 10, color: C.stone, fontWeight: 700, textTransform: 'uppercase' }}>{isZone(selected) ? 'Label' : 'Table Name'}</label>
                <input value={inspectName} onChange={e => setInspectName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', marginTop: 4 }} />
              </div>
              {!isZone(selected) && (
                <div>
                  <label style={{ fontSize: 10, color: C.stone, fontWeight: 700, textTransform: 'uppercase' }}>Max Capacity</label>
                  <input type="number" min="1" value={inspectCapacity} onChange={e => setInspectCapacity(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, outline: 'none', marginTop: 4 }} />
                </div>
              )}
              <div style={{ fontSize: 9, color: C.stone, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                {shapeMeta(selected.shape).label}
                {!isZone(selected) && ` • ${occByTable[selected.id] || 0} / ${selected.max_capacity} seated`}
                {isZone(selected) && ` • ${Math.round(elWidth(selected))}×${Math.round(elHeight(selected))} · ${Math.round(Number(selected.rotation) || 0)}°`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveInspector} style={{ ...btn, flex: 1, background: C.gold, color: C.white, padding: '7px 10px', fontSize: 11 }}>Save</button>
                <button onClick={duplicateElement} style={{ ...btn, background: 'rgba(184,148,79,0.06)', border: '1px solid rgba(184,148,79,0.2)', color: C.gold, padding: '7px 10px', fontSize: 11 }}>Duplicate</button>
                <button onClick={deleteElement} style={{ ...btn, background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.2)', color: C.danger, padding: '7px 10px', fontSize: 11 }}>Delete</button>
              </div>

              {!isZone(selected) && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
                  <span style={{ fontSize: 10, color: C.stone, fontWeight: 700 }}>Seated Guests ({seatedHere.length})</span>
                  <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {seatedHere.length === 0 ? (
                      <p style={{ fontSize: 12, color: C.stone, fontStyle: 'italic' }}>No guests seated yet.</p>
                    ) : seatedHere.map(g => (
                      <div key={g.id} style={{ background: '#FAFAF8', padding: 8, border: `1px solid #F0ECE3`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.guest_name}</span>
                          <span style={{ fontSize: 10, color: C.stone }}>Party of {g.party_size}</span>
                        </div>
                        <button onClick={() => unseatGuest(g)} style={{ padding: '4px 10px', background: 'rgba(196,94,94,0.06)', border: '1px solid rgba(196,94,94,0.15)', borderRadius: 6, fontSize: 10, fontWeight: 700, color: C.danger, cursor: 'pointer' }}>Unseat</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add element modal */}
      {showAdd && <AddElementModal onClose={() => setShowAdd(false)} onAdd={addElement} btn={btn} view={view} />}

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={logout} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Smart helper for naming incrementing (letters/numbers)
   ════════════════════════════════════════════════════════════════ */
function generateNumberedName(baseName, index, startNum) {
  // 1. Check if name ends with a single letter (e.g. Table A or Table a)
  const letterMatch = baseName.match(/^(.*?)\s*([a-zA-Z])$/);
  if (letterMatch) {
    const prefix = letterMatch[1];
    const letter = letterMatch[2];
    const charCode = letter.charCodeAt(0);
    const newCharCode = charCode + index;
    if ((letter >= 'A' && letter <= 'Z' && newCharCode <= 90) ||
        (letter >= 'a' && letter <= 'z' && newCharCode <= 122)) {
      return `${prefix} ${String.fromCharCode(newCharCode)}`.trim();
    }
  }

  // 2. Check if name ends with a number (e.g. Table 1)
  const numMatch = baseName.match(/^(.*?)\s*(\d+)$/);
  if (numMatch) {
    const prefix = numMatch[1];
    const num = parseInt(numMatch[2]);
    return `${prefix} ${num + index}`.trim();
  }

  return `${baseName} ${startNum + index}`.trim();
}

/* ════════════════════════════════════════════════════════════════
   Add element modal — pick a shape (table) or a zone, then details
   ════════════════════════════════════════════════════════════════ */
function AddElementModal({ onClose, onAdd, btn, view }) {
  const [shape, setShape] = useState('round');
  const meta = SHAPES[shape];
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(String(SHAPES.round.defaultCap));
  const [customColor, setCustomColor] = useState('');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  // Layout arrangement states
  const [isMultiple, setIsMultiple] = useState(false);
  const [layoutMode, setLayoutMode] = useState('horizontal'); // 'horizontal', 'vertical', 'grid'
  const [quantity, setQuantity] = useState('4');
  const [gridCols, setGridCols] = useState('3');
  const [gridRows, setGridRows] = useState('2');
  const [spacing, setSpacing] = useState('40');
  const [startNumber, setStartNumber] = useState('1');
  const [autoNumber, setAutoNumber] = useState(true);

  const pick = (s) => {
    setShape(s);
    setCapacity(String(SHAPES[s].defaultCap || 8));
    setCustomColor(SHAPES[s].color || '');
    setCustomWidth(String(SHAPES[s].w));
    setCustomHeight(String(SHAPES[s].h));
    if (!name.trim()) setName(SHAPES[s].label);
  };

  const tables = Object.entries(SHAPES).filter(([, m]) => m.cat === 'table');
  const zones = Object.entries(SHAPES).filter(([, m]) => m.cat === 'zone');

  const submit = () => {
    if (!name.trim()) { toast.error('Please enter a label.'); return; }
    
    let numElements = 1;
    let qty = 1;
    let cols = 1;
    let rows = 1;
    let gap = 40;
    
    if (isMultiple) {
      gap = parseInt(spacing);
      if (isNaN(gap) || gap < 0) { toast.error('Please enter a valid spacing.'); return; }
      
      if (layoutMode !== 'grid') {
        qty = parseInt(quantity);
        if (isNaN(qty) || qty < 2 || qty > 50) { toast.error('Quantity must be between 2 and 50.'); return; }
        numElements = qty;
      } else {
        cols = parseInt(gridCols);
        rows = parseInt(gridRows);
        if (isNaN(cols) || cols < 1 || cols > 10 || isNaN(rows) || rows < 1 || rows > 10) {
          toast.error('Grid columns and rows must be between 1 and 10.');
          return;
        }
        if (cols * rows < 2) {
          toast.error('Grid layout must contain at least 2 elements.');
          return;
        }
        numElements = cols * rows;
      }
    }

    const payloads = [];
    const itemW = meta.cat === 'table' ? meta.w : (parseInt(customWidth) || meta.w);
    const itemH = meta.cat === 'table' ? meta.h : (parseInt(customHeight) || meta.h);
    
    const startXPercent = clamp((-view.tx / view.scale) / WORLD_W * 100 + 8, 2, 90);
    const startYPercent = clamp((-view.ty / view.scale) / WORLD_H * 100 + 8, 2, 90);
    const startXPx = startXPercent / 100 * WORLD_W;
    const startYPx = startYPercent / 100 * WORLD_H;

    for (let i = 0; i < numElements; i++) {
      let xPx = startXPx;
      let yPx = startYPx;

      if (isMultiple) {
        if (layoutMode === 'horizontal') {
          xPx = startXPx + i * (itemW + gap);
        } else if (layoutMode === 'vertical') {
          yPx = startYPx + i * (itemH + gap);
        } else if (layoutMode === 'grid') {
          const colIdx = i % cols;
          const rowIdx = Math.floor(i / cols);
          xPx = startXPx + colIdx * (itemW + gap);
          yPx = startYPx + rowIdx * (itemH + gap);
        }
      }

      const xPct = clamp((xPx / WORLD_W) * 100, 2, 98);
      const yPct = clamp((yPx / WORLD_H) * 100, 2, 98);

      let finalName = name.trim();
      if (isMultiple && autoNumber) {
        finalName = generateNumberedName(finalName, i, parseInt(startNumber) || 1);
      }

      const payload = {
        shape,
        tableName: finalName,
        elementType: meta.cat,
        x: xPct,
        y: yPct,
      };

      if (meta.cat === 'table') {
        const cap = parseInt(capacity);
        if (isNaN(cap) || cap < 1) { toast.error('Enter a valid capacity.'); return; }
        payload.maxCapacity = cap;
      } else {
        payload.width = parseInt(customWidth) || meta.w;
        payload.height = parseInt(customHeight) || meta.h;
        payload.color = customColor || meta.color;
      }

      payloads.push(payload);
    }

    onAdd(payloads);
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)', transition: 'border-color 0.2s' };
  const labelStyle = { fontSize: 11, color: C.stone, fontWeight: 600, display: 'block', marginBottom: 4 };

  const Tile = ({ s, m }) => (
    <button key={s} onClick={() => pick(s)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px', borderRadius: 10, border: `1px solid ${shape === s ? C.gold : C.border}`, background: shape === s ? 'rgba(184,148,79,0.08)' : C.white, cursor: 'pointer', transition: 'all 0.15s' }}>
      <span style={{ fontSize: 20 }}>{m.icon || (m.round ? '⬤' : '▭')}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: C.charcoal, textAlign: 'center' }}>{m.label}</span>
    </button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(25,27,30,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, border: `1px solid ${C.border}`, width: '100%', maxWidth: 520, borderRadius: 16, padding: 24, maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500 }}>Add Element</h3>

        <div>
          <span style={{ fontSize: 11, color: C.stone, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tables</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
            {tables.map(([s, m]) => <Tile key={s} s={s} m={m} />)}
          </div>
        </div>
        <div>
          <span style={{ fontSize: 11, color: C.stone, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Venue Zones</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
            {zones.map(([s, m]) => <Tile key={s} s={s} m={m} />)}
          </div>
        </div>

        {/* Details section */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 11, color: C.stone, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Details</span>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{meta.cat === 'zone' ? 'Label' : 'Table Name'}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={meta.label} style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
            </div>
            {meta.cat === 'table' && (
              <div style={{ width: 120 }}>
                <label style={labelStyle}>Capacity</label>
                <input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            )}
          </div>

          {meta.cat === 'zone' && (
            <>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Width (px)</label>
                  <input type="number" min="60" value={customWidth || meta.w} onChange={e => setCustomWidth(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Height (px)</label>
                  <input type="number" min="50" value={customHeight || meta.h} onChange={e => setCustomHeight(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={customColor || meta.color || C.gold} onChange={e => setCustomColor(e.target.value)} style={{ width: 40, height: 36, border: `1px solid ${C.border}`, borderRadius: 8, padding: 2, cursor: 'pointer', background: C.white }} />
                  <input value={customColor || meta.color || ''} onChange={e => setCustomColor(e.target.value)} placeholder="#hex color" style={{ ...inputStyle, flex: 1 }} onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              </div>
            </>
          )}

          {/* Multiple Elements Layout section */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={isMultiple} onChange={e => setIsMultiple(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.charcoal }}>Add multiple elements in a layout</span>
            </label>

            {isMultiple && (
              <div style={{
                marginTop: 4, padding: 14, background: C.softBg, border: `1px solid ${C.border}`,
                borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12,
                animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Arrangement</label>
                    <select value={layoutMode} onChange={e => setLayoutMode(e.target.value)} style={inputStyle}>
                      <option value="horizontal">Horizontal Row</option>
                      <option value="vertical">Vertical Column</option>
                      <option value="grid">Grid Layout</option>
                    </select>
                  </div>
                  {layoutMode !== 'grid' ? (
                    <div style={{ width: 120 }}>
                      <label style={labelStyle}>Quantity</label>
                      <input type="number" min="2" max="50" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} />
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 70 }}>
                        <label style={labelStyle}>Columns</label>
                        <input type="number" min="1" max="10" value={gridCols} onChange={e => setGridCols(e.target.value)} style={inputStyle} />
                      </div>
                      <div style={{ width: 70 }}>
                        <label style={labelStyle}>Rows</label>
                        <input type="number" min="1" max="10" value={gridRows} onChange={e => setGridRows(e.target.value)} style={inputStyle} />
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Gap Spacing (px)</label>
                    <input type="number" min="0" max="500" value={spacing} onChange={e => setSpacing(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Start Numbering</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="number" min="1" value={startNumber} onChange={e => setStartNumber(e.target.value)} style={{ ...inputStyle, flex: 1 }} disabled={!autoNumber} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 11, color: C.stone }}>
                        <input type="checkbox" checked={autoNumber} onChange={e => setAutoNumber(e.target.checked)} />
                        Auto
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <button onClick={onClose} style={{ ...btn, background: C.white, border: `1px solid ${C.border}`, color: C.stone }}>Cancel</button>
          <button onClick={submit} style={{ ...btn, background: C.gold, color: C.white }}>Add to Canvas</button>
        </div>
      </div>
    </div>
  );
}
