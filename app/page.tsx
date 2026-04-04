"use client";

import { useEffect, useState, ComponentType } from 'react';
import LayoutShell from './components/dashboard/LayoutShell';
import styles from './page.module.css';
import { ChevronDown, Repeat, Wallet, CreditCard, Upload } from 'lucide-react';
import { useAuth } from '@/app/context/AuthProvider';
import Link from 'next/link';
import AnalysisDashboard from './components/analysis/AnalysisDashboard';
import PatrimonyToggle, { type PatrimonyView } from './components/dashboard/PatrimonyToggle';
import RubrosDonutChart from './components/charts/RubrosDonutChart';
import ArbitrageWidget from './components/charts/ArbitrageWidget';
import DebtBurndownChart from './components/charts/DebtBurndownChart';
import { StyledDiv } from './components/ui/StyledElements';



interface DashboardMetrics {
    netWorth: number;
    cashFlow: number;
    savingsRate: number | null;
    runway: number;
    dti: number | null;
    history: { month: string; income: number; expense: number }[];
    accountSummary?: {
      total: number;
      banks: number;
      credit: number;
      cash: number;
      others: number;
    };
}


interface Transaction {
    id: string;
    amount: number;
    type: string;
    description: string;
    date: string;
    isParent: boolean;
    account: { name: string };
    category: { name: string; icon: string; color: string } | null;
    msiPlan?: { months: number; totalAmount: number } | null;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(6);
  const [patrimonyView, setPatrimonyView] = useState<PatrimonyView>('personal');
  const [showImporter, setShowImporter] = useState(false);
  const [importerData, setImporterData] = useState<{ accounts: {id:string;name:string;type:string}[]; categories: {id:string;name:string;icon:string;type:string}[] } | null>(null);


  useEffect(() => {
    async function fetchData() {
      try {
        const [metricsRes, txRes] = await Promise.all([
          fetch('/api/dashboard/metrics'),
          fetch('/api/transactions?limit=15')
        ]);
        
        if (metricsRes.ok) {
          const mData = await metricsRes.json();
          setMetrics(mData);
        }
        
        if (txRes.ok) {
          const tData = await txRes.json();
          const txArray = Array.isArray(tData) ? tData : (tData.transactions ?? []);
          const recent = txArray.filter((tx: Transaction) => !tx.isParent).slice(0, 7);
          setTransactions(recent);
        }
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (user) {
      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  // Carga accounts + categories solo cuando el usuario abre el importer
  const handleOpenImporter = async () => {
    if (!importerData) {
      const [accsRes, catsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/categories'),
      ]);
      const [accs, cats] = await Promise.all([accsRes.json(), catsRes.json()]);
      setImporterData({
        accounts: Array.isArray(accs) ? accs : [],
        categories: Array.isArray(cats) ? cats : [],
      });
    }
    setShowImporter(true);
  };

  const handleImportComplete = () => {
    setShowImporter(false);
    // Refresca movimientos recientes
    fetch('/api/transactions?limit=15')
      .then(r => r.json())
      .then(tData => {
        const txArray = Array.isArray(tData) ? tData : (tData.transactions ?? []);
        setTransactions(txArray.filter((tx: Transaction) => !tx.isParent).slice(0, 7));
      });

  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  const getTypeSign = (type: string) => {
    if (type === 'INCOME') return '+';
    if (type === 'EXPENSE' || type === 'MSI_CHARGE') return '-';
    if (type === 'TRANSFER' || type === 'PAGO_TARJETA') return '⇆';
    return '';
  };
  
  const getTypeColor = (type: string) => {
    if (type === 'INCOME') return '#10b981'; // Green
    if (type === 'EXPENSE' || type === 'MSI_CHARGE') return 'var(--text-primary)';
    if (type === 'TRANSFER' || type === 'PAGO_TARJETA') return '#3b82f6'; // Blue
    return 'var(--text-secondary)';
  };

  const getTypeName = (type: string) => {
    switch(type) {
      case 'INCOME': return 'Ingreso';
      case 'EXPENSE': return 'Gasto';
      case 'MSI_CHARGE': return 'MSI';
      case 'TRANSFER': return 'Transferencia';
      case 'PAGO_TARJETA': return 'Pago Tarjeta';
      default: return type;
    }
  };

  // Determine chart values based on the last history
  const history = metrics?.history || [];
  const chartData = history.slice(-timeRange);
  const maxExpense = Math.max(...chartData.map(h => h.expense), 1); // Avoid division by zero
  
  // Calculate totals for the selected range
  const rangeTotals = chartData.reduce((acc, curr) => ({
    income: acc.income + curr.income,
    expense: acc.expense + curr.expense
  }), { income: 0, expense: 0 });

  // Current month for quick reference if needed



  return (
    <>
    <LayoutShell>
      <div className={styles.pageContainer}>
        {/* Balance Card Section */}
        <div className={styles.balanceCardWrapper}>
           <div className={styles.balanceCard}>
             {/* Toggle Patrimonio Personal / Hogar — Fase 3 */}
             <div className={styles.patrimonyToggleWrapper}>
               <PatrimonyToggle value={patrimonyView} onChange={setPatrimonyView} />
             </div>

             <div className={styles.balanceLabel}>
               {patrimonyView === 'personal' ? 'Patrimonio Personal' : 'Vista del Hogar'}
             </div>
             <div className={styles.balanceValue}>
               {loading ? 'Cargando...' : formatCurrency(metrics?.netWorth || 0)}
             </div>
             {patrimonyView === 'hogar' && (
               <div className={styles.patrimonySubnote}>
                 Incluye cuentas compartidas (próximamente)
               </div>
             )}
             {metrics?.accountSummary && (
               <div className={styles.jointAccounts}>
                 <div className={styles.accountIcons}>
                   {metrics.accountSummary.banks > 0 && <span title="Bancos">🏦</span>}
                   {metrics.accountSummary.credit > 0 && <span title="Tarjetas">💳</span>}
                   {metrics.accountSummary.cash > 0 && <span title="Efectivo">💵</span>}
                 </div>
                 <div className={styles.jointText}>
                   {metrics.accountSummary.banks} Bancos • {metrics.accountSummary.credit} Tarjetas 
                   {metrics.accountSummary.others > 0 ? ` • ${metrics.accountSummary.others + metrics.accountSummary.cash} Otros` : ''}
                 </div>
               </div>
             )}
           </div>
        </div>
        
        {/* Analysis Overview (Timeline, Debt Ratio, Hormiga) */}
        <AnalysisDashboard />

        {/* Activity Analysis Chart */}
        <section className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Análisis de Actividad</h2>
              <p className={styles.sectionDesc}>Comparativa de ingresos vs gastos por mes. Cada barra representa el gasto relativo al periodo máximo.</p>
            </div>
            <div className={styles.filterContainer}>
              <select 
                className={styles.rangeSelect} 
                value={timeRange} 
                onChange={(e) => setTimeRange(Number(e.target.value))}
                title="Seleccionar periodo"
              >
                <option value={3}>Últimos 3 Meses</option>
                <option value={6}>Últimos 6 Meses</option>
                <option value={12}>Último Año</option>
              </select>
              <ChevronDown size={14} className={styles.selectIcon} />
            </div>
          </div>
          
          <div className={styles.chartBars}>
            {chartData.length > 0 ? (
              chartData.map((dataItem, index) => {
                const heightPercent = Math.max(10, Math.min(100, (dataItem.expense / maxExpense) * 100));
                return (
                  <div key={index} className={styles.barCol}>
                  <div className={styles.bar}>
                     <StyledDiv className={styles.barFill} applyStyle={{ height: `${heightPercent}%` }} />
                  </div>
                    <span className={styles.barLabel}>{dataItem.month}</span>
                  </div>
                );
              })
            ) : (
              <div className={styles.emptyChart}>Sin movimientos en este periodo</div>
            )}
            
            {/* Fallback empty bars if less than requested exists */}
            {chartData.length > 0 && chartData.length < timeRange && Array.from({ length: Math.max(0, timeRange - chartData.length) }).map((_, i) => (
              <div key={`empty-${i}`} className={styles.barCol}>
                <div className={styles.bar}>
                   <div className={styles.barFill} />
                </div>
                <span className={styles.barLabel}>-</span>
              </div>
            ))}
          </div>

          <div className={styles.incomeExpenseScores}>
            <div className={styles.scoreItem}>
              <div className={styles.scoreLabel}>Ingresos del periodo</div>
              <div className={`${styles.scoreValue} ${styles.valIncome}`}>
                <div className={`${styles.dot} ${styles.dotIncome}`}></div>
                +{formatCurrency(rangeTotals.income)}
              </div>
            </div>
            <div className={styles.scoreItem}>
              <div className={styles.scoreLabel}>Gastos del periodo</div>
              <div className={`${styles.scoreValue} ${styles.valExpense}`}>
                <div className={`${styles.dot} ${styles.dotExpense}`}></div>
                -{formatCurrency(rangeTotals.expense)}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================
            FASE 4: Módulo Prescriptivo Antigravity
        ======================================== */}
        <section className={styles.intelligenceSection}>
          <div className={styles.intelligenceLabel}>
            🚀 Inteligencia Financiera
          </div>
          <p className={styles.intelligenceDesc}>
            Análisis avanzado de tu situación financiera. Detecta oportunidades, visualiza tus hábitos de gasto y proyecta el pago de tus deudas.
          </p>

          {/* 4A: Widget de Arbitraje */}
          <div className={styles.intelligenceWidgetBlock}>
            <p className={styles.widgetDesc}>💡 <strong>Arbitraje:</strong> Compara el costo de tu deuda (CAT) vs el rendimiento de tus inversiones. Si el CAT supera el rendimiento, conviene liquidar deuda primero.</p>
            <ArbitrageWidget />
          </div>

          {/* 4B: Donut Chart de Rubros */}
          <div className={styles.intelligenceWidgetBlock}>
            <p className={styles.widgetDesc}>🍩 <strong>Gastos por Rubro:</strong> Distribución de tus gastos del mes por categoría. Identifica en qué rubros se concentra tu gasto para tomar mejores decisiones.</p>
            <RubrosDonutChart />
          </div>

          {/* 4C: Debt Burn-Down Chart */}
          <div className={styles.intelligenceWidgetBlock}>
            <p className={styles.widgetDesc}>📉 <strong>Proyección de Deuda:</strong> Simula cuánto tiempo tardarías en liquidar una deuda con pagos mínimos vs pagos adicionales. Ajusta el deslizador para ver el impacto de cada peso extra.</p>
            <DebtBurndownChart />
          </div>
        </section>

        <div className={styles.quickActions}>
          <Link href="/transactions" className={styles.actionBtn} aria-label="Transferir">
             <div className={`${styles.actionIconBox} ${styles.blue}`}>
               <Repeat size={24} />
             </div>
             <span className={styles.actionLabel}>Transferir</span>
          </Link>
          <Link href="/transactions/new" className={styles.actionBtn} aria-label="Pagar">
             <div className={`${styles.actionIconBox} ${styles.orange}`}>
               <Wallet size={24} />
             </div>
             <span className={styles.actionLabel}>Pagar</span>
          </Link>
          <Link href="/accounts" className={styles.actionBtn} aria-label="Tarjetas">
             <div className={`${styles.actionIconBox} ${styles.green}`}>
               <CreditCard size={24} />
             </div>
             <span className={styles.actionLabel}>Tarjetas</span>
          </Link>
          <button
            className={styles.actionBtn}
            aria-label="Importar estado de cuenta"
            onClick={handleOpenImporter}
          >
            <div className={`${styles.actionIconBox} ${styles.purple}`}>
              <Upload size={24} />
            </div>
            <span className={styles.actionLabel}>Importar</span>
          </button>
        </div>



        {/* Recent Transactions */}
        <div className={styles.recentHeader}>
          <div>
            <h2 className={`${styles.sectionTitle} ${styles.noMargin}`}>Movimientos Recientes</h2>
            <p className={styles.sectionDesc}>Tus últimos movimientos registrados. Haz clic en &quot;Ver todos&quot; para filtrar, buscar o importar estados de cuenta.</p>
          </div>
          <Link href="/transactions" className={styles.viewAll}>Ver todos</Link>
        </div>
        
        <div className={styles.transactionList}>
          {loading ? (
             <div className={styles.centeredText}>Cargando movimientos...</div>
          ) : transactions.length === 0 ? (
             <div className={styles.centeredText}>No hay movimientos recientes</div>
          ) : (
             transactions.map(tx => (
                <div key={tx.id} className={styles.transactionItem}>
                  <StyledDiv className={styles.txIcon} applyStyle={{ background: tx.category?.color || 'var(--background)' }}>
                     {tx.category?.icon || (tx.type === 'INCOME' ? '⬆️' : '🛒')}
                  </StyledDiv>
                  <div className={styles.txDetails}>
                    <div className={styles.txName}>{tx.description || tx.category?.name || 'Transacción'}</div>
                    <div className={styles.txMeta}>
                      <span className={styles.metaAccount}>{tx.account.name}</span>
                      <span className={styles.metaDivider}>•</span>
                      <span className={styles.metaCategory}>{tx.category?.name}</span>
                    </div>
                    <div className={styles.txBadges}>
                      <span className={`${styles.badge} ${styles[`badge_${tx.type}`]}`}>
                        {getTypeName(tx.type)}
                      </span>
                      {tx.type === 'MSI_CHARGE' && tx.msiPlan && (
                        <span className={styles.badgeMSI}>
                          Plan: {formatCurrency(tx.msiPlan.totalAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.txRight}>
                    <StyledDiv className={styles.txAmount} applyStyle={{ color: getTypeColor(tx.type) }}>
                      {getTypeSign(tx.type)}{formatCurrency(Number(tx.amount))}
                    </StyledDiv>
                    <div className={styles.txDate}>{formatDate(tx.date)}</div>
                  </div>
                </div>
             ))
          )}
        </div>

      </div>
    </LayoutShell>

    {/* ── Statement Importer Modal ── */}
    {showImporter && importerData && (
      <StatementImporterLazy
        accounts={importerData!.accounts}
        categories={importerData!.categories}
        onImportComplete={handleImportComplete}
        onClose={() => setShowImporter(false)}
      />
    )}
    </>
  );
}

// Lazy-load para no bloquear el TTI del dashboard
function StatementImporterLazy(props: { accounts: {id:string;name:string;type:string}[]; categories: {id:string;name:string;icon:string;type:string}[]; onImportComplete: () => void; onClose: () => void; }) {
  type Comp = ComponentType<{ accounts: {id:string;name:string;type:string}[]; categories: {id:string;name:string;icon:string;type:string}[]; onImportComplete: () => void; onClose: () => void; }>;
  const [Component, setComponent] = useState<Comp | null>(null);
  useEffect(() => {
    import('./components/StatementImporter').then(m => setComponent(() => m.default as Comp));
  }, []);
  if (!Component) return null;
  return <Component {...props} />;
}
