import React, { useMemo, memo } from "react";
import { isAccepted, isDeclined } from '../../utils/responseHelpers';

const SeatingManager = memo(function SeatingManager({
  rsvps,
  tables,
  searchQuery,
  setSearchQuery,
  filterResponse,
  setFilterResponse,
  onAssignTable,
}) {
  const filteredRsvps = useMemo(() => {
    return rsvps.filter((r) => {
      const name = r.guest_name || "";
      const email = r.email || "";
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterResponse === "all" ||
        (filterResponse === "yes" && isAccepted(r.response)) ||
        (filterResponse === "no" && isDeclined(r.response)) ||
        (filterResponse === "pending" && !isAccepted(r.response) && !isDeclined(r.response));
      return matchesSearch && matchesFilter;
    });
  }, [rsvps, searchQuery, filterResponse]);

  const inputStyle = {
    background: "#FFFFFF",
    border: "1px solid #E8E2D6",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    color: "#191B1E",
    outline: "none",
    fontFamily: "var(--font-sans)",
    transition: "border-color 0.25s ease",
  };

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D6",
        padding: "24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* Filters Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #F0ECE3",
          paddingBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
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
            Guest List &amp; Seating
          </h3>
          <p
            style={{
              fontSize: "10px",
              color: "#77736A",
              fontFamily: "var(--font-sans)",
              marginTop: "2px",
            }}
          >
            Assign confirmed guests to table slots
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <input
            type="text"
            placeholder="Search guests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, width: "176px" }}
            onFocus={(e) => (e.target.style.borderColor = "#B8944F")}
            onBlur={(e) => (e.target.style.borderColor = "#E8E2D6")}
            aria-label="Search guests"
          />

          <select
            value={filterResponse}
            onChange={(e) => setFilterResponse(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
            aria-label="Filter by response"
          >
            <option value="all">All Responses</option>
            <option value="yes">Attending (Yes)</option>
            <option value="no">Declined (No)</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Guest Seating Grid — table on desktop, stacked cards on mobile (a raw
          table forced into overflow-x:auto is unusable on a phone; both are
          rendered and toggled via CSS so there's no JS viewport check). */}
      <div className="seating-table-wrap" style={{ overflowX: "auto", width: "100%" }}>
        {filteredRsvps.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 0",
              fontSize: "13px",
              color: "#77736A",
              fontStyle: "italic",
              fontFamily: "var(--font-sans)",
            }}
          >
            No matching guests found.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              textAlign: "left",
              fontSize: "13px",
              borderCollapse: "collapse",
              fontFamily: "var(--font-sans)",
            }}
          >
            <thead>
              <tr>
                {["Guest", "Party", "Response", "Meal Choices", "Seating / Table"].map(
                  (header, i) => (
                    <th
                      key={header}
                      style={{
                        paddingBottom: "12px",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#77736A",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        borderBottom: "1px solid #F0ECE3",
                        textAlign: i === 4 ? "right" : "left",
                      }}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRsvps.map((guest) => {
                const isYes = isAccepted(guest.response);
                const isNo = isDeclined(guest.response);

                return (
                  <tr
                    key={guest.id}
                    style={{
                      borderBottom: "1px solid #F8F4EC",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#FDFCF9")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td style={{ padding: "14px 0", fontWeight: 500, color: "#191B1E" }}>
                      {guest.guest_name}
                      <span
                        style={{
                          display: "block",
                          fontSize: "10px",
                          color: "#A09A91",
                          marginTop: "2px",
                          fontWeight: 400,
                        }}
                      >
                        {guest.email}
                      </span>
                    </td>
                    <td style={{ padding: "14px 0", color: "#191B1E" }}>
                      {guest.party_size}
                    </td>
                    <td style={{ padding: "14px 0" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "6px",
                          fontSize: "9px",
                          fontWeight: 700,
                          background: isYes
                            ? "rgba(184,148,79,0.1)"
                            : isNo
                            ? "rgba(196,94,94,0.08)"
                            : "rgba(119,115,106,0.1)",
                          color: isYes ? "#B8944F" : isNo ? "#C45E5E" : "#77736A",
                        }}
                      >
                        {(guest.response || 'PENDING').toUpperCase()}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "14px 0",
                        fontSize: "12px",
                        color: "#77736A",
                        maxWidth: "150px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={guest.meal}
                    >
                      {guest.meal}
                    </td>
                    <td style={{ padding: "14px 0", textAlign: "right" }}>
                      {isYes ? (
                        <select
                          value={guest.tableId}
                          onChange={(e) => onAssignTable(guest.id, e.target.value)}
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #E8E2D6",
                            fontSize: "12px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            color: "#191B1E",
                            cursor: "pointer",
                            outline: "none",
                            fontFamily: "var(--font-sans)",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "#B8944F")}
                          onBlur={(e) => (e.target.style.borderColor = "#E8E2D6")}
                          aria-label={`Assign table for ${guest.guest_name}`}
                        >
                          <option value="">Unassigned</option>
                          {tables.map((t) => {
                            const isCurrent = t.id === guest.tableId;
                            const remaining = t.max_capacity - t.occupied;
                            return (
                              <option
                                key={t.id}
                                value={t.id}
                                disabled={!isCurrent && remaining < guest.party_size}
                              >
                                {t.table_name} (
                                {isCurrent ? "Current" : `${remaining} left`})
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#A09A91",
                            fontStyle: "italic",
                          }}
                        >
                          Exempt
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filteredRsvps.length > 0 && (
        <div className="seating-cards-wrap" style={{ display: "none", flexDirection: "column", gap: "10px" }}>
          {filteredRsvps.map((guest) => {
            const isYes = isAccepted(guest.response);
            const isNo = isDeclined(guest.response);
            return (
              <div key={guest.id} style={{ border: "1px solid #F0ECE3", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 500, color: "#191B1E", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {guest.guest_name}
                    </span>
                    <span style={{ display: "block", fontSize: "10px", color: "#A09A91", marginTop: "2px" }}>{guest.email}</span>
                  </div>
                  <span style={{
                    flexShrink: 0, display: "inline-block", padding: "3px 10px", borderRadius: "6px", fontSize: "9px", fontWeight: 700,
                    background: isYes ? "rgba(184,148,79,0.1)" : isNo ? "rgba(196,94,94,0.08)" : "rgba(119,115,106,0.1)",
                    color: isYes ? "#B8944F" : isNo ? "#C45E5E" : "#77736A",
                  }}>
                    {(guest.response || 'PENDING').toUpperCase()}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "11px", color: "#77736A" }}>
                  <span>Party of {guest.party_size}</span>
                  {guest.meal && <span>· {guest.meal}</span>}
                </div>

                <div style={{ borderTop: "1px solid #F8F4EC", paddingTop: "8px" }}>
                  {isYes ? (
                    <select
                      value={guest.tableId}
                      onChange={(e) => onAssignTable(guest.id, e.target.value)}
                      style={{
                        width: "100%", background: "#FFFFFF", border: "1px solid #E8E2D6", fontSize: "13px",
                        padding: "8px 10px", borderRadius: "8px", color: "#191B1E", cursor: "pointer",
                        outline: "none", fontFamily: "var(--font-sans)",
                      }}
                      aria-label={`Assign table for ${guest.guest_name}`}
                    >
                      <option value="">Unassigned</option>
                      {tables.map((t) => {
                        const isCurrent = t.id === guest.tableId;
                        const remaining = t.max_capacity - t.occupied;
                        return (
                          <option key={t.id} value={t.id} disabled={!isCurrent && remaining < guest.party_size}>
                            {t.table_name} ({isCurrent ? "Current" : `${remaining} left`})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <span style={{ fontSize: "10px", color: "#A09A91", fontStyle: "italic" }}>Exempt from seating</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          .seating-table-wrap { display: none; }
          .seating-cards-wrap { display: flex !important; }
        }
      `}</style>
    </div>
  );
});

export default SeatingManager;
