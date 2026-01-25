import LayoutShell from './components/dashboard/LayoutShell';
import MetricsGrid from './components/dashboard/MetricsGrid';
import styles from './components/dashboard/dashboard.module.css';

export default function Home() {
  return (
    <LayoutShell>
      <h1 className={styles.pageTitle}>Dashboard</h1>
      <p className={styles.pageSubtitle}>
        Bienvenido. Aquí está tu resumen financiero.
      </p>
      <MetricsGrid />
    </LayoutShell>
  );
}
