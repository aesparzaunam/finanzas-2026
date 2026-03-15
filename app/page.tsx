"use client";

import { useEffect, useState } from 'react';
import LayoutShell from './components/dashboard/LayoutShell';
import styles from './page.module.css';
import { ChevronDown, Repeat, Wallet, CreditCard, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/app/context/AuthProvider';
import Link from 'next/link';
import AnalysisDashboard from './components/analysis/AnalysisDashboard';

interface DashboardMetrics {
    netWorth: number;
    cashFlow: number;
    savingsRate: number;
    runway: number;
    dti: number;
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
          if (Array.isArray(tData)) {
            const recent = tData.filter((tx: Transaction) => !tx.isParent).slice(0, 7);
            setTransactions(recent);
          }
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
    <LayoutShell>
      <div className={styles.pageContainer}>
        {/* Balance Card Section */}
        <div style={{ padding: 'var(--space-4) 0 var(--space-8)' }}>
           <div className={styles.balanceCard}>
             <div className={styles.balanceLabel}>Patrimonio Neto</div>
             <div className={styles.balanceValue}>
               {loading ? 'Cargando...' : formatCurrency(metrics?.netWorth || 0)}
             </div>
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
            <h2 className={styles.sectionTitle}>Análisis de Actividad</h2>
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
                     <div className={styles.barFill} style={{ '--bar-height': `${heightPercent}%` } as React.CSSProperties} />
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
          <button className={styles.actionBtn} aria-label="Más acciones">
            <div className={`${styles.actionIconBox} ${styles.purple}`}>
              <MoreHorizontal size={24} />
            </div>
            <span className={styles.actionLabel}>Más</span>
          </button>
        </div>

        {/* Recent Transactions */}
        <div className={styles.recentHeader}>
          <h2 className={`${styles.sectionTitle} ${styles.noMargin}`}>Movimientos Recientes</h2>
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
                  <div className={styles.txIcon} style={{ '--tx-bg': tx.category?.color || 'var(--background)' } as React.CSSProperties}>
                     {tx.category?.icon || (tx.type === 'INCOME' ? '⬆️' : '🛒')}
                  </div>
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
                    <div className={styles.txAmount} style={{ '--tx-color': getTypeColor(tx.type) } as React.CSSProperties}>
                      {getTypeSign(tx.type)}{formatCurrency(Number(tx.amount))}
                    </div>
                    <div className={styles.txDate}>{formatDate(tx.date)}</div>
                  </div>
                </div>
             ))
          )}
        </div>

      </div>
    </LayoutShell>
  );
}
