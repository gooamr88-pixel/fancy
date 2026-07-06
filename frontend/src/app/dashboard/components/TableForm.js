import React, { useState, memo } from "react";

const TableForm = memo(function TableForm({
  tables,
  newTableName,
  setNewTableName,
  newTableCapacity,
  setNewTableCapacity,
  onCreateTable,
  onUpdateTable,
}) {
  const [editingTableId, setEditingTableId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editShape, setEditShape] = useState('round');

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        padding: "24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #F0ECE3",
          paddingBottom: "12px",
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 500,
              color: "#191B1E",
            }}
          >
            Tables Layout
          </h3>
          <p
            style={{
              fontSize: "10px",
              color: "#77736A",
              fontFamily: "var(--font-sans)",
              marginTop: "2px",
            }}
          >
            Overview of physical seating tables
          </p>
        </div>
        <span
          style={{
            background: "rgba(184,148,79,0.1)",
            border: "1px solid rgba(184,148,79,0.2)",
            color: "#B8944F",
            fontSize: "12px",
            padding: "3px 12px",
            borderRadius: "20px",
            fontWeight: 700,
            fontFamily: "var(--font-sans)",
          }}
        >
          {tables.length} Tables
        </span>
      </div>

      {/* Tables List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxHeight: "300px",
          overflowY: "auto",
          paddingRight: "4px",
        }}
      >
        {tables.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: "#77736A",
              fontStyle: "italic",
              padding: "24px 0",
              fontFamily: "var(--font-sans)",
            }}
          >
            No tables created yet. Add one below!
          </div>
        ) : (
          tables.map((table) => {
            const isEditing = editingTableId === table.id;
            const occupied = table.occupied || 0;
            const cap = table.max_capacity || 1;
            const remaining = cap - occupied;
            const fillPercent = Math.min(100, (occupied / cap) * 100);

            let barColor = "#B8944F";
            if (fillPercent >= 100) barColor = "#C45E5E";
            else if (fillPercent >= 80) barColor = "#D7BE80";

            if (isEditing) {
              return (
                <div
                  key={table.id}
                  style={{
                    background: "#FAFAF8",
                    padding: "16px",
                    border: "2px solid #B8944F",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px', color: '#77736A', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Table Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", fontSize: "12px", border: "1px solid #E8E2D6", borderRadius: "6px", color: "#191B1E", outline: 'none' }}
                      />
                    </div>
                    <div style={{ width: '80px' }}>
                      <label style={{ fontSize: '9px', color: '#77736A', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", fontSize: "12px", border: "1px solid #E8E2D6", borderRadius: "6px", color: "#191B1E", outline: 'none' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: '#77736A', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Shape</label>
                    <select
                      value={editShape}
                      onChange={(e) => setEditShape(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", fontSize: "12px", border: "1px solid #E8E2D6", borderRadius: "6px", color: "#191B1E", cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="round">Round</option>
                      <option value="rectangular">Rectangular</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={() => setEditingTableId(null)}
                      style={{ minHeight: "44px", padding: "5px 12px", background: "transparent", border: "1px solid #E8E2D6", borderRadius: "6px", fontSize: "11px", color: "#77736A", cursor: "pointer", fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateTable?.(table.id, {
                          tableName: editName,
                          maxCapacity: parseInt(editCapacity),
                          shape: editShape
                        });
                        setEditingTableId(null);
                      }}
                      style={{ minHeight: "44px", padding: "5px 16px", background: "#B8944F", border: "none", borderRadius: "6px", fontSize: "11px", color: "#FFFFFF", cursor: "pointer", fontWeight: 700 }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={table.id}
                style={{
                  background: "#FAFAF8",
                  padding: "16px",
                  border: "1px solid #F0ECE3",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(184,148,79,0.3)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "#F0ECE3")
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "12px",
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: "#191B1E" }}>{table.table_name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTableId(table.id);
                        setEditName(table.table_name);
                        setEditCapacity(table.max_capacity);
                        setEditShape(table.shape || 'round');
                      }}
                      style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#B8944F' }}
                      title="Edit Table"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                  <span style={{ color: "#77736A" }}>
                    {occupied} / {cap} seats occupied
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: "6px",
                    width: "100%",
                    background: "#F8F4EC",
                    borderRadius: "9999px",
                    overflow: "hidden",
                    border: "1px solid #F0ECE3",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      transition: "width 0.5s ease",
                      borderRadius: "9999px",
                      background: barColor,
                      width: `${fillPercent}%`,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "10px",
                    fontWeight: 700,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <span
                    style={{
                      color: "#A09A91",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {table.shape || "round"}
                  </span>
                  <span
                    style={{
                      color: remaining === 0 ? "#C45E5E" : "#B8944F",
                    }}
                  >
                    {remaining === 0 ? "Full" : `${remaining} empty`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table Creation Form */}
      <form
        onSubmit={onCreateTable}
        style={{
          borderTop: "1px solid #F0ECE3",
          paddingTop: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h4
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#77736A",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontFamily: "var(--font-sans)",
          }}
        >
          Add New Table
        </h4>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label htmlFor="table-name-input" style={{ display: "none" }}>
              Table Name
            </label>
            <input
              id="table-name-input"
              type="text"
              placeholder="e.g. VIP Table"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#FFFFFF",
                border: "1px solid #E8E2D6",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "12px",
                color: "#191B1E",
                outline: "none",
                fontFamily: "var(--font-sans)",
                transition: "border-color 0.25s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#B8944F")}
              onBlur={(e) => (e.target.style.borderColor = "#E8E2D6")}
              required
            />
          </div>
          <div>
            <label htmlFor="table-capacity-input" style={{ display: "none" }}>
              Max Capacity
            </label>
            <input
              id="table-capacity-input"
              type="number"
              min="1"
              placeholder="Capacity"
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#FFFFFF",
                border: "1px solid #E8E2D6",
                borderRadius: "8px",
                padding: "10px 12px",
                fontSize: "12px",
                color: "#191B1E",
                outline: "none",
                fontFamily: "var(--font-sans)",
                transition: "border-color 0.25s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#B8944F")}
              onBlur={(e) => (e.target.style.borderColor = "#E8E2D6")}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          id="btn-add-table"
          style={{
            width: "100%",
            padding: "12px",
            background: "#B8944F",
            color: "#FFFFFF",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
            fontFamily: "var(--font-sans)",
          }}
          onMouseEnter={(e) => (e.target.style.background = "#a6833f")}
          onMouseLeave={(e) => (e.target.style.background = "#B8944F")}
        >
          Add Table Plan
        </button>
      </form>
    </div>
  );
});

export default TableForm;
