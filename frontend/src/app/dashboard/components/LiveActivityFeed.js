import React from "react";

export default function LiveActivityFeed({ rsvps }) {
  // Take last 5 RSVPs to display
  const recentRsvps = [...rsvps].slice(0, 8);

  return (
    <div className="bg-card-bg/60 border border-card-border/60 p-6 rounded-xl flex flex-col gap-4 backdrop-blur-md">
      <div className="flex justify-between items-center border-b border-card-border/40 pb-3">
        <div>
          <h3 className="font-serif text-lg font-normal tracking-wide text-foreground">Live RSVP Activity</h3>
          <p className="text-[10px] text-muted-text">Real-time update streams for guest responses</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green text-[10px] font-bold border border-brand-green/20 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
          Live
        </span>
      </div>

      <div className="overflow-y-auto no-scrollbar flex flex-col gap-3 max-h-[280px]">
        {recentRsvps.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-text italic">
            Waiting for RSVP records...
          </div>
        ) : (
          recentRsvps.map((guest, idx) => {
            const initials = guest.guest_name
              ? guest.guest_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
              : "?";

            const isYes = guest.response === "yes" || guest.response === "YES" || guest.response === "Accepted";

            return (
              <div 
                key={guest.id || idx} 
                className="p-3 border border-card-border/40 bg-sec-bg/10 rounded-xl flex justify-between items-center text-xs hover:border-brand-green/20 hover:bg-sec-bg/25 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ${
                    isYes ? "bg-emerald-100 dark:bg-emerald-950/40 text-brand-green" : "bg-rose-105 dark:bg-rose-950/40 text-rose-500"
                  }`}>
                    {initials}
                  </div>
                  <div>
                    <span className="font-bold text-foreground block">{guest.guest_name}</span>
                    <span className="text-[10px] text-muted-text block leading-none mt-1">
                      {isYes 
                        ? `Party: ${guest.party_size} | Meal: ${guest.meal || "-"}`
                        : "Declined invitation"
                      }
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold ${
                    isYes ? "bg-emerald-500/10 text-brand-green" : "bg-rose-500/10 text-rose-500"
                  }`}>
                    {isYes ? "ACCEPT" : "DECLINE"}
                  </span>
                  <span className="text-[8.5px] text-muted-text/80 block mt-1 leading-none">
                    {guest.timestamp || "Just now"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
