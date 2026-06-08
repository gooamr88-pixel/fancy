import React from "react";

export default function ResponsiveChartBoard({ stats }) {
  const attending = stats.attendingGuests || 0;
  const declined = stats.declinedGuests || 0;
  const pending = stats.pendingGuests || 0;
  const total = attending + declined + pending || 1;

  const yesPercent = Math.round((attending / total) * 100);
  const noPercent = Math.round((declined / total) * 100);
  const pendingPercent = Math.round((pending / total) * 100);

  // SVG Donut calculations
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // 314.159
  
  const yesDash = (attending / total) * circumference;
  const noDash = (declined / total) * circumference;
  const pendingDash = (pending / total) * circumference;

  const noOffset = circumference - yesDash;
  const pendingOffset = noOffset - noDash;

  // Meal breakdown
  const meals = stats.mealSummary || {};
  const mealKeys = Object.keys(meals);
  const mealTotal = Object.values(meals).reduce((acc, curr) => acc + curr, 0) || 1;

  return (
    <div className="bg-card-bg/60 border border-card-border/60 p-6 rounded-xl flex flex-col gap-6 backdrop-blur-md">
      <div>
        <h3 className="font-serif text-lg font-normal tracking-wide text-foreground">Analytics Overview</h3>
        <p className="text-[10px] text-muted-text">Real-time attendance rates and meal options</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        
        {/* SVG Donut Chart (Attendance Rate) */}
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-card-border/30 fill-transparent"
                strokeWidth="10"
              />
              
              {/* YES Segment (Emerald) */}
              {attending > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="stroke-brand-green fill-transparent transition-all duration-1000"
                  strokeWidth="10"
                  strokeDasharray={`${yesDash} ${circumference}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
              )}

              {/* NO Segment (Rose) */}
              {declined > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="stroke-rose-500 fill-transparent transition-all duration-1000"
                  strokeWidth="10"
                  strokeDasharray={`${noDash} ${circumference}`}
                  strokeDashoffset={-yesDash}
                  strokeLinecap="round"
                />
              )}

              {/* PENDING Segment (Slate) */}
              {pending > 0 && (
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  className="stroke-stone-400 fill-transparent transition-all duration-1000"
                  strokeWidth="10"
                  strokeDasharray={`${pendingDash} ${circumference}`}
                  strokeDashoffset={-(yesDash + noDash)}
                  strokeLinecap="round"
                />
              )}
            </svg>
            
            {/* Center Text */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tracking-tight text-foreground">{yesPercent}%</span>
              <span className="text-[9px] font-bold text-brand-green uppercase tracking-wider">Acceptance</span>
            </div>
          </div>

          {/* Legends */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-brand-green block"></span>
              <span className="font-semibold text-foreground">Attending: {attending} <span className="text-muted-text font-normal">({yesPercent}%)</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-rose-500 block"></span>
              <span className="font-semibold text-foreground">Declined: {declined} <span className="text-muted-text font-normal">({noPercent}%)</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded bg-stone-400 block"></span>
              <span className="font-semibold text-foreground">Pending: {pending} <span className="text-muted-text font-normal">({pendingPercent}%)</span></span>
            </div>
          </div>
        </div>

        {/* Meal Breakdown Chart (Horizontal bars) */}
        <div className="flex flex-col gap-4">
          <h4 className="text-xs font-bold text-muted-text uppercase tracking-wider border-b border-card-border/40 pb-1">Meal Preferences</h4>
          
          <div className="flex flex-col gap-3.5">
            {mealKeys.length === 0 ? (
              <div className="text-xs text-muted-text italic py-4">
                No meal data submitted yet.
              </div>
            ) : (
              mealKeys.map((meal) => {
                const count = meals[meal] || 0;
                const percentage = Math.round((count / mealTotal) * 100);
                return (
                  <div key={meal} className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between font-medium text-foreground">
                      <span>{meal}</span>
                      <span className="font-bold">{count} <span className="text-[10px] text-muted-text font-normal">({percentage}%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-sec-bg rounded-full overflow-hidden border border-card-border/30">
                      <div 
                        className="h-full bg-brand-green rounded-full transition-all duration-700" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
