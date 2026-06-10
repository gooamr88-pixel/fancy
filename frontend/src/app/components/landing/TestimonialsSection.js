"use client";

import React, { useState } from "react";

const TestimonialsSection = React.memo(function TestimonialsSection() {
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  const testimonials = [
    {
      quote: "Fancy RSVP was a complete game-changer for our wedding. The opening envelope visual set such an elegant, exclusive tone, and the Web Audio background synthesizer arpeggios had everyone talking before they even clicked attend!",
      author: "Eleanor & James Vance",
      tag: "Wedding Suite"
    },
    {
      quote: "The automated address validation saved us countless bouncebacks. Having all dietary preferences and meal options updated in a real-time graph made event catering planning completely stress-free.",
      author: "Marcus Chen, Creative Lead",
      tag: "Corporate Charity Gala"
    },
    {
      quote: "Finally, a way to invite guests sustainably without sacrificing design aesthetics. Our baby shower invitations felt incredibly personal, high-end, and saved trees while doing it.",
      author: "Sienna & Lucas Keller",
      tag: "Baby Shower Suite"
    }
  ];

  return (
    <section className="w-full py-28 bg-card-bg border-b border-card-border/40">
      <div className="max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
        <span className="text-brand-green uppercase tracking-widest text-xs font-bold font-sans">Customer Stories</span>
        <h2 className="font-serif text-3xl font-normal text-foreground mt-2 mb-12">What Hosts Say</h2>
        
        <div className="w-full min-h-[180px] flex flex-col justify-between items-center relative">
          
          {/* Sliding quote */}
          <div className="animate-fade-in flex flex-col items-center gap-6" key={testimonialIdx}>
            <p className="font-serif text-xl md:text-2xl text-foreground italic leading-relaxed max-w-3xl text-center">
              “{testimonials[testimonialIdx].quote}”
            </p>
            <div>
              <h4 className="font-bold text-sm text-foreground">{testimonials[testimonialIdx].author}</h4>
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider mt-1 block">
                {testimonials[testimonialIdx].tag}
              </span>
            </div>
          </div>
          
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => setTestimonialIdx(prev => prev === 0 ? testimonials.length - 1 : prev - 1)}
            className="w-9 h-9 border border-card-border rounded-full hover:bg-sec-bg/50 flex items-center justify-center text-muted-text hover:text-foreground transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Previous Testimonial"
            id="testimonial-prev"
          >
            ←
          </button>
          <button
            onClick={() => setTestimonialIdx(prev => (prev + 1) % testimonials.length)}
            className="w-9 h-9 border border-card-border rounded-full hover:bg-sec-bg/50 flex items-center justify-center text-muted-text hover:text-foreground transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Next Testimonial"
            id="testimonial-next"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
});

export default TestimonialsSection;
