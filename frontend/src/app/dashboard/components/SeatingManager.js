import React, { useMemo, memo } from "react";

const SeatingManager = memo(function SeatingManager({
  rsvps,
  tables,
  searchQuery,
  setSearchQuery,
  filterResponse,
  setFilterResponse,
  onAssignTable
}) {
  // Memoize filtered RSVP guest list for performance
  const filteredRsvps = useMemo(() => {
    return rsvps.filter(r => {
      const name = r.guest_name || "";
      const email = r.email || "";
      const matchesSearch = 
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterResponse === "all" || r.response === filterResponse;
      return matchesSearch && matchesFilter;
    });
  }, [rsvps, searchQuery, filterResponse]);

  return (
    <div className="bg-card-bg/60 border border-card-border/60 p-6 rounded-xl flex flex-col gap-4 backdrop-blur-md">
      
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-card-border/40 pb-4">
        <div>
          <h3 className="font-serif text-lg font-normal tracking-wide text-foreground">Guest List &amp; Seating</h3>
          <p className="text-[10px] text-muted-text">Assign confirmed guests to table slots</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search guests..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-sec-bg/40 border border-card-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green w-full sm:w-44 transition-all"
            aria-label="Search guests"
          />
          
          <select
            value={filterResponse}
            onChange={e => setFilterResponse(e.target.value)}
            className="bg-sec-bg/40 border border-card-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
            aria-label="Filter by response"
          >
            <option value="all">All Responses</option>
            <option value="yes">Attending (Yes)</option>
            <option value="no">Declined (No)</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Guest Seating Grid */}
      <div className="overflow-x-auto w-full">
        {filteredRsvps.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-text italic">
            No matching guests found.
          </div>
        ) : (
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-card-border/50 text-muted-text text-[10px] uppercase font-bold tracking-wider">
                <th className="pb-3 font-semibold">Guest</th>
                <th className="pb-3 font-semibold">Party</th>
                <th className="pb-3 font-semibold">Response</th>
                <th className="pb-3 font-semibold">Meal Choices</th>
                <th className="pb-3 font-semibold text-right">Seating / Table</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border/30">
              {filteredRsvps.map(guest => {
                const isYes = guest.response === "yes" || guest.response === "YES" || guest.response === "Accepted";
                const isNo = guest.response === "no" || guest.response === "NO" || guest.response === "Declined";

                return (
                  <tr key={guest.id} className="hover:bg-sec-bg/15 transition-colors duration-200 group">
                    <td className="py-3.5 font-medium text-foreground">
                      {guest.guest_name}
                      <span className="block text-[10px] text-muted-text/80 leading-none mt-1 font-normal">
                        {guest.email}
                      </span>
                    </td>
                    <td className="py-3.5 text-foreground">{guest.party_size}</td>
                    <td className="py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        isYes 
                          ? "bg-emerald-500/10 text-brand-green" 
                          : isNo 
                            ? "bg-rose-500/10 text-rose-500" 
                            : "bg-stone-500/10 text-stone-500"
                      }`}>
                        {guest.response.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 text-xs text-muted-text max-w-[150px] truncate" title={guest.meal}>
                      {guest.meal}
                    </td>
                    <td className="py-3.5 text-right">
                      {isYes ? (
                        <select
                          value={guest.tableId}
                          onChange={e => onAssignTable(guest.id, e.target.value)}
                          className="bg-card-bg border border-card-border hover:border-brand-green text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-green text-foreground cursor-pointer transition-all shadow-sm"
                          aria-label={`Assign table for ${guest.guest_name}`}
                        >
                          <option value="">Unassigned</option>
                          {tables.map(t => {
                            const isCurrent = t.id === guest.tableId;
                            const remaining = t.max_capacity - t.occupied;
                            return (
                              <option 
                                key={t.id} 
                                value={t.id}
                                disabled={!isCurrent && remaining < guest.party_size}
                              >
                                {t.table_name} ({isCurrent ? 'Current' : `${remaining} left`})
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span className="text-[10px] text-muted-text/75 italic">Exempt</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
});

export default SeatingManager;
