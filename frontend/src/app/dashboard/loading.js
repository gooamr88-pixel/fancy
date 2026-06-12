export default function DashboardLoading() {
  return (
    <div style={styles.container}>
      <style>{pulseKeyframes}</style>

      {/* Sidebar skeleton */}
      <aside style={styles.sidebar}>
        <div style={{ ...styles.bar, width: '60%', height: 28, marginBottom: 32 }} />
        {[72, 85, 68, 90, 76, 82].map((w, i) => (
          <div key={i} style={{ ...styles.bar, width: `${w}%`, height: 16, marginBottom: 20 }} />
        ))}
      </aside>

      {/* Main content skeleton */}
      <main style={styles.main}>
        {/* Header bar */}
        <div style={styles.headerBar}>
          <div style={{ ...styles.bar, width: 220, height: 24 }} />
          <div style={{ ...styles.bar, width: 140, height: 36, borderRadius: 8 }} />
        </div>

        {/* Stat cards */}
        <div style={styles.cardGrid}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={styles.statCard}>
              <div style={{ ...styles.bar, width: '50%', height: 14, marginBottom: 12 }} />
              <div style={{ ...styles.bar, width: '70%', height: 28 }} />
            </div>
          ))}
        </div>

        {/* Chart area */}
        <div style={styles.chartArea}>
          <div style={{ ...styles.bar, width: 180, height: 18, marginBottom: 16 }} />
          <div style={{ ...styles.bar, width: '100%', height: 200, borderRadius: 8 }} />
        </div>

        {/* Table skeleton */}
        <div style={styles.tableArea}>
          <div style={{ ...styles.bar, width: 160, height: 18, marginBottom: 16 }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} style={styles.tableRow}>
              <div style={{ ...styles.bar, width: '25%', height: 14 }} />
              <div style={{ ...styles.bar, width: '20%', height: 14 }} />
              <div style={{ ...styles.bar, width: '30%', height: 14 }} />
              <div style={{ ...styles.bar, width: '15%', height: 14 }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const pulseKeyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#F8F4EC',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#FFFFFF',
    borderRight: '1px solid #E8E2D6',
    padding: '24px 16px',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    padding: 32,
    overflow: 'auto',
  },
  headerBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 20,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 12,
    padding: 20,
  },
  chartArea: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
  },
  tableArea: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8E2D6',
    borderRadius: 12,
    padding: 24,
  },
  tableRow: {
    display: 'flex',
    gap: 16,
    padding: '12px 0',
    borderBottom: '1px solid #E8E2D6',
  },
  bar: {
    backgroundColor: '#E8E2D6',
    borderRadius: 6,
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  },
};
