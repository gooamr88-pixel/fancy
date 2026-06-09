import React, { memo } from "react";

const TableForm = memo(function TableForm({
  tables,
  newTableName,
  setNewTableName,
  newTableCapacity,
  setNewTableCapacity,
  onCreateTable
}) {
  return (
    <div className="bg-card-bg/60 border border-card-border/60 p-6 rounded-xl space-y-6 backdrop-blur-md">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-card-border/40 pb-3">
        <div>
          <h3 className="font-serif text-lg font-normal tracking-wide text-foreground">Tables Layout</h3>
          <p className="text-[10px] text-muted-text">Overview of physical seating tables</p>
        </div>
        <span className="bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs px-2.5 py-0.5 rounded-full font-bold">
          {tables.length} Tables
        </span>
      </div>

      {/* Tables List */}
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
        {tables.length === 0 ? (
          <div className="text-center text-xs text-muted-text italic py-6">
            No tables created yet. Add one below!
          </div>
        ) : (
          tables.map(table => {
            const occupied = table.occupied || 0;
            const cap = table.max_capacity || 1;
            const remaining = cap - occupied;
            const fillPercent = Math.min(100, (occupied / cap) * 100);
            
            let barColor = "bg-blue-500";
            if (fillPercent >= 100) barColor = "bg-rose-500";
            else if (fillPercent >= 80) barColor = "bg-amber-500";

            return (
              <div key={table.id} className="bg-sec-bg/15 p-4 border border-card-border/40 rounded-xl space-y-2.5 hover:border-brand-green/20 transition-all duration-300">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-foreground">{table.table_name}</span>
                  <span className="text-muted-text">
                    {occupied} / {cap} seats occupied
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-sec-bg rounded-full overflow-hidden border border-card-border/20">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${barColor}`} 
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-muted-text/75 uppercase tracking-wider">{table.shape || "round"}</span>
                  <span className={remaining === 0 ? "text-rose-500" : "text-brand-green"}>
                    {remaining === 0 ? "Full" : `${remaining} empty`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table Creation Form */}
      <form onSubmit={onCreateTable} className="border-t border-card-border/40 pt-4 space-y-4">
        <h4 className="text-xs font-bold text-muted-text uppercase tracking-wider">Add New Table</h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="table-name-input" className="sr-only">Table Name</label>
            <input
              id="table-name-input"
              type="text"
              placeholder="e.g. VIP Table"
              value={newTableName}
              onChange={e => setNewTableName(e.target.value)}
              className="bg-sec-bg/30 border border-card-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="table-capacity-input" className="sr-only">Max Capacity</label>
            <input
              id="table-capacity-input"
              type="number"
              min="1"
              max="50"
              placeholder="Capacity"
              value={newTableCapacity}
              onChange={e => setNewTableCapacity(e.target.value)}
              className="bg-sec-bg/30 border border-card-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand-green"
              required
            />
          </div>
        </div>

        <button 
          type="submit"
          className="w-full py-2.5 bg-brand-green hover:bg-brand-green-hover text-white rounded-lg text-xs font-bold transition shadow-md active:scale-98 border-b-2 border-emerald-700 cursor-pointer"
          id="btn-add-table"
        >
          Add Table Plan
        </button>
      </form>
    </div>
  );
});

export default TableForm;
