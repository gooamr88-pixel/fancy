'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi from '../../_lib/adminApi';
import Modal, { Button } from '../../_components/Modal';
import { T, card } from '../../_components/theme';
import { useAlert } from '../../_components/AlertContext';

/**
 * Roles & Permissions (Master Plan §18). Lists roles with their permission
 * counts and lets an rbac.manage admin edit a custom role's permission matrix.
 * super_admin is shown read-only (implicit wildcard).
 */
export default function RolesPage() {
  const { showAlert } = useAlert();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // role being edited
  const [draft, setDraft] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const [r, p, a] = await Promise.all([
          adminApi.get('/rbac/roles'),
          adminApi.get('/rbac/permissions'),
          adminApi.get('/rbac/admins'),
        ]);
        if (!ignore) {
          setRoles(r?.roles || []);
          setPermissions(p?.permissions || []);
          setAdmins(a?.admins || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load RBAC data');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [nonce]);

  const openEdit = (role) => {
    setEditing(role);
    setDraft(new Set(role.permissions || []));
  };

  const toggle = (key) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.put(`/rbac/roles/${editing.id}/permissions`, { permissionKeys: Array.from(draft) });
      setEditing(null);
      reload();
    } catch (err) {
      await showAlert(err.message || 'Failed to save', 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: T.text500 }}>Loading roles…</p>;
  if (error) return <p style={{ color: T.danger }}>{error}</p>;

  // Group permissions for the editor.
  const groups = {};
  permissions.forEach((p) => { (groups[p.group] ||= []).push(p); });

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text900, margin: 0, fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Roles &amp; Permissions</h1>
        <p style={{ fontSize: 13, color: T.text500, margin: '4px 0 0' }}>{permissions.length} permissions across {roles.length} roles.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
        {roles.map((role) => (
          <div key={role.id} style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, color: T.text900 }}>{role.name}</div>
                <div style={{ fontSize: 11, color: T.text400, fontFamily: 'monospace' }}>{role.key}</div>
              </div>
              {role.isSystem && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: T.text500, background: T.surfaceAlt, padding: '2px 6px', borderRadius: 6 }}>system</span>}
            </div>
            <p style={{ fontSize: 12, color: T.text500, margin: '8px 0 12px', minHeight: 32 }}>{role.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: T.text700, fontWeight: 600 }}>
                {role.key === 'super_admin' ? 'All permissions' : `${role.permissions.length} permissions`}
              </span>
              {role.key !== 'super_admin' && <Button variant="ghost" onClick={() => openEdit(role)}>Edit</Button>}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text900, margin: '0 0 12px' }}>Admin users</h2>
      <div style={{ ...card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
            {['Name', 'Email', 'Roles', 'Status'].map((h) => <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.text500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {admins.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: T.text400 }}>No admin users.</td></tr>
            ) : admins.map((a) => (
              <tr key={a.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                <td style={{ padding: '12px 18px' }}>{a.name || '—'}</td>
                <td style={{ padding: '12px 18px', color: T.text500 }}>{a.email || '—'}</td>
                <td style={{ padding: '12px 18px' }}>{(a.roles || []).map((r) => r.name).join(', ') || '—'}</td>
                <td style={{ padding: '12px 18px' }}>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        title={editing ? `Edit permissions — ${editing.name}` : ''}
        onClose={() => setEditing(null)}
        width={640}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        {Object.entries(groups).map(([group, perms]) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: T.text400, fontWeight: 700, marginBottom: 6 }}>{group}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
              {perms.map((p) => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text700, cursor: 'pointer' }}>
                  <input type="checkbox" checked={draft.has(p.key)} onChange={() => toggle(p.key)} />
                  <span title={p.description} style={{ fontFamily: 'monospace' }}>{p.key}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}
