/* Two visual variants existed pre-consolidation, both used across marketing
   pages: "compact" (fixed 60px lines, 18px star) on careers/press/about/blog,
   and "wide" (flexible lines, 20px star, maxWidth 280px) on
   templates/integrations/features. Preserved here as-is rather than merged
   into one look, to avoid an unrequested visual change. */
export default function GoldDivider({ variant = "compact" }) {
  if (variant === "wide") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", margin: "0 auto", maxWidth: "280px" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, #D7BE80)" }} />
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L12 8L18 10L12 12L10 18L8 12L2 10L8 8Z" fill="#B8944F" opacity="0.5" />
        </svg>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, #D7BE80, transparent)" }} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", padding: "12px 0" }}>
      <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, transparent, #D7BE80)" }} />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L11 7H17L12 11L14 17L9 13L4 17L6 11L1 7H7L9 1Z" fill="#D7BE80" opacity="0.5" />
      </svg>
      <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, #D7BE80, transparent)" }} />
    </div>
  );
}
