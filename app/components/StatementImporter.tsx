'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './StatementImporter.module.css';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  suggestedCategory?: string;
  suggestedCategoryId?: string;
  isMSI?: boolean;
  msiCurrentMonth?: number;
  msiTotalMonths?: number;
  msiTotalAmount?: number;
}

interface ImportResult {
  transactions: ParsedTransaction[];
  bank: string;
  totalFound: number;
  source: 'csv' | 'excel' | 'pdf_ai';
  suggestedAccountId?: string;
  warnings?: string[];
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  type: string;
}

export interface StatementImporterProps {
  accounts: Account[];
  categories: Category[];
  onImportComplete: () => void;
  onClose: () => void;
}

const BANK_LOGOS: Record<string, { name: string; color: string; emoji: string }> = {
  AMEX:         { name: 'American Express', color: '#016FD0', emoji: '💳' },
  BBVA:         { name: 'BBVA',             color: '#004481', emoji: '🏦' },
  BANORTE:      { name: 'Banorte',          color: '#D50032', emoji: '🏛️' },
  MERCADO_PAGO: { name: 'Mercado Pago',     color: '#00B1EA', emoji: '💙' },
  LIVERPOOL:    { name: 'Liverpool',        color: '#c8102e', emoji: '🛍️' },
  GENERIC:      { name: 'Banco detectado',  color: '#6B7280', emoji: '🏦' },
  AUTO_DETECTADO: { name: 'Auto detectado', color: '#8B5CF6', emoji: '🤖' },
};

export default function StatementImporter({ accounts, categories, onImportComplete, onClose }: StatementImporterProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping' | 'importing' | 'done'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [rowSelections, setRowSelections] = useState<Record<number, boolean>>({});
  const [rowCategories, setRowCategories] = useState<Record<number, string>>({}); // categoryId por fila
  const [importedCount, setImportedCount] = useState(0);
  // MSI modal
  const [msiTx, setMsiTx] = useState<{ tx: ParsedTransaction; idx: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // AbortController para cancelar si el usuario cierra o tarda demasiado
  const abortControllerRef = useRef<AbortController | null>(null);

  // Limpieza al desmontar
  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsLoading(true);

    // Timeout extendido: 150 s para inferencia local (modelo 27B puede tardar)
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 150_000);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import-statement', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error procesando archivo');

      setImportResult(data);
      // Si la IA detectó la cuenta correcta, pre-seleccionarla
      if (data.suggestedAccountId) {
        setSelectedAccountId(data.suggestedAccountId);
      }
      // Seleccionar todas las filas por defecto
      const selections: Record<number, boolean> = {};
      const cats: Record<number, string> = {};
      data.transactions.forEach((tx: ParsedTransaction, i: number) => {
        selections[i] = true;
        cats[i] = tx.suggestedCategoryId || '';
      });
      setRowSelections(selections);
      setRowCategories(cats);
      setStep('preview');
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if ((err as { name?: string }).name === 'AbortError') {
        setError('La solicitud tardó demasiado. Asegúrate de que Ollama está corriendo y el modelo está descargado.');
      } else {
        setError(err instanceof Error ? err.message : 'Error procesando archivo');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const toggleRow = (i: number) => {
    setRowSelections(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const toggleAll = () => {
    const allSelected = Object.values(rowSelections).every(Boolean);
    const newSel: Record<number, boolean> = {};
    importResult?.transactions.forEach((_, i) => (newSel[i] = !allSelected));
    setRowSelections(newSel);
  };

  const selectedCount = Object.values(rowSelections).filter(Boolean).length;

  const handleConfirmImport = async () => {
    if (!selectedAccountId) {
      setError('Selecciona una cuenta de destino');
      return;
    }
    if (!importResult) return;

    setStep('importing');
    setIsLoading(true);
    setError(null);

    const toImport = importResult.transactions
      .map((tx, i) => ({ tx, i }))
      .filter(({ i }) => rowSelections[i]);
    let successCount = 0;

    for (const { tx, i: idx } of toImport) {
      try {
        const payload = {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          accountId: selectedAccountId,
          // Prioridad: categoría elegida por fila > defaultCategoryId
          categoryId: rowCategories[idx] || defaultCategoryId || null,
        };

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) successCount++;
        // silent fail - user can retry individual transactions
      } catch {
        // silent fail
      }
    }

    setImportedCount(successCount);
    setIsLoading(false);
    setStep('done');
    if (successCount > 0) onImportComplete();
  };

  const bankInfo = importResult ? (BANK_LOGOS[importResult.bank] || BANK_LOGOS.GENERIC) : null;

  return (
    <>
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon}>📥</span>
            <div>
              <h2>Importar Estado de Cuenta</h2>
              <p>AMEX · BBVA · Banorte · Mercado Pago</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Steps indicator */}
        <div className={styles.steps}>
          {['upload', 'preview', 'importing', 'done'].map((s, i) => (
            <div key={s} className={`${styles.step} ${step === s || (step === 'mapping' && s === 'preview') ? styles.stepActive : ''} ${i < ['upload', 'preview', 'importing', 'done'].indexOf(step) ? styles.stepDone : ''}`}>
              <div className={styles.stepDot}>{i + 1}</div>
              <span>{['Subir archivo', 'Vista previa', 'Importando', 'Listo'][i]}</span>
            </div>
          ))}
        </div>

        {/* ── STEP: Upload ── */}
        {step === 'upload' && (
          <div className={styles.body}>
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls"
                title="Seleccionar estado de cuenta"
                aria-label="Seleccionar estado de cuenta (PDF, CSV, Excel)"
                className={styles.hiddenInput}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {isLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <p>Analizando documento con IA local…</p>
                  <span>⏳ Esto puede tomar 1-2 minutos mientras el modelo procesa el documento.</span>
                  <span className={styles.loadingModelHint}>Ollama · {process.env.NEXT_PUBLIC_LOCAL_LLM_MODEL || 'qwen-claude'}</span>
                </div>
              ) : (
                <>
                  <div className={styles.dropIcon}>📄</div>
                  <h3>Arrastra tu estado de cuenta aquí</h3>
                  <p>o haz clic para seleccionar el archivo</p>
                  <div className={styles.formats}>
                    <span className={styles.formatBadge}>PDF</span>
                    <span className={styles.formatBadge}>CSV</span>
                    <span className={styles.formatBadge}>XLSX</span>
                    <span className={styles.formatBadge}>XLS</span>
                  </div>
                </>
              )}
            </div>

            {error && <div className={styles.error}>⚠️ {error}</div>}

            <div className={styles.bankGrid}>
              {Object.entries(BANK_LOGOS).filter(([k]) => k !== 'GENERIC' && k !== 'AUTO_DETECTADO').map(([key, { name, emoji }]) => (
                <div
                  key={key}
                  className={styles.bankChip}
                  data-bank={key}
                >
                  <span>{emoji}</span>
                  <span className={styles.bankChipName}>{name}</span>
                </div>
              ))}
            </div>

            <p className={styles.hint}>
              💡 Todos los formatos (PDF, CSV, Excel) se procesan con <strong>IA Local (Ollama)</strong>.
              Los PDFs escaneados usan OCR automático como respaldo.
            </p>
          </div>
        )}

        {/* ── STEP: Preview ── */}
        {step === 'preview' && importResult && bankInfo && (
          <div className={styles.body}>
            {/* Bank + stats */}
            <div
              className={styles.importStats}
              data-bank={importResult.bank}
            >
              <div className={styles.bankName}>
                <span>{bankInfo.emoji}</span>
                <strong className={styles.bankNameText}>{bankInfo.name}</strong>
                <span className={styles.sourceBadge}>
                  {importResult.source === 'pdf_ai' ? '🤖 IA Local' : importResult.source === 'csv' ? '📋 CSV' : '📊 Excel'}
                </span>
              </div>
              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <span className={styles.statVal}>{importResult.totalFound}</span>
                  <span className={styles.statLabel}>Movimientos</span>
                </div>
                <div className={styles.stat}>
                  <span className={`${styles.statVal} ${styles.statExpense}`}>
                    ${importResult.transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={styles.statLabel}>Total cargos</span>
                </div>
                <div className={styles.stat}>
                  <span className={`${styles.statVal} ${styles.statIncome}`}>
                    ${importResult.transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={styles.statLabel}>Total abonos</span>
                </div>
              </div>
            </div>

            {/* Account + Category selectors */}
            <div className={styles.selectors}>
              <div className={styles.selectorGroup}>
                <label htmlFor="select-account">Cuenta de destino *</label>
                <select id="select-account" title="Cuenta de destino" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className={styles.select}>
                  <option value="">-- Selecciona cuenta --</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {importResult.suggestedAccountId && importResult.suggestedAccountId === selectedAccountId && (
                  <div className={styles.accountDetectedHint}>
                    🤖 IA Local detectó esta cuenta automáticamente
                  </div>
                )}
              </div>
              <div className={styles.selectorGroup}>
                <label htmlFor="select-category">Categoría por defecto</label>
                <select id="select-category" title="Categoría por defecto" value={defaultCategoryId} onChange={e => setDefaultCategoryId(e.target.value)} className={styles.select}>
                  <option value="">-- Sin categoría --</option>
                  {categories.filter(c => c.type === 'EXPENSE' || !c.type).map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className={styles.error}>⚠️ {error}</div>}

            {/* Transaction table */}
            <div className={styles.tableWrapper}>
              <div className={styles.tableHeader}>
                <span>{selectedCount} de {importResult.totalFound} seleccionados</span>
                <button className={styles.toggleAllBtn} onClick={toggleAll}>
                  {Object.values(rowSelections).every(Boolean) ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Monto</th>
                      <th>Tipo</th>
                      <th>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.transactions.map((tx, i) => (
                      <tr key={i} className={`${styles.row} ${!rowSelections[i] ? styles.rowDeselected : ''}`} onClick={() => toggleRow(i)}>
                        <td>
                          <input type="checkbox" title="Seleccionar movimiento" aria-label={`Seleccionar movimiento ${i + 1}`} checked={!!rowSelections[i]} onChange={() => toggleRow(i)} onClick={e => e.stopPropagation()} />
                        </td>
                        <td className={styles.dateCell}>{new Date(tx.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className={styles.descCell} title={tx.description}>{tx.description || '—'}</td>
                        <td className={`${styles.amountCell} ${tx.type === 'EXPENSE' ? styles.expense : styles.income}`}>
                          {tx.type === 'EXPENSE' ? '-' : '+'}${tx.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`${styles.typeBadge} ${tx.type === 'EXPENSE' ? styles.expenseBadge : styles.incomeBadge}`}>
                            {tx.type === 'EXPENSE' ? '↑ Cargo' : '↓ Abono'}
                          </span>
                          {tx.isMSI && (
                            <span className={styles.msiBadge}>
                              🔴 MSI {tx.msiCurrentMonth}/{tx.msiTotalMonths}
                            </span>
                          )}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <select
                            title="Categoría del movimiento"
                            className={styles.rowCategorySelect}
                            value={rowCategories[i] || ''}
                            onChange={e => setRowCategories(prev => ({ ...prev, [i]: e.target.value }))}
                          >
                            <option value="">— Sin categoría</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.icon} {c.name}
                              </option>
                            ))}
                          </select>
                          {tx.suggestedCategory && !rowCategories[i] && (
                            <div className={styles.suggestionHint}>🧠 {tx.suggestedCategory}</div>
                          )}
                          {tx.isMSI && (
                            <button
                              className={styles.msiCreateBtn}
                              onClick={e => { e.stopPropagation(); setMsiTx({ tx, idx: i }); }}
                              title="Crear Plan MSI con estos datos"
                            >
                              + Crear Plan MSI
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Importing ── */}
        {step === 'importing' && (
          <div className={styles.body}>
            <div className={styles.importingState}>
              <div className={styles.bigSpinner} />
              <h3>Importando movimientos…</h3>
              <p>Guardando {selectedCount} transacciones en tu cuenta</p>
            </div>
          </div>
        )}

        {/* ── STEP: Done ── */}
        {step === 'done' && (
          <div className={styles.body}>
            <div className={styles.doneState}>
              <div className={styles.doneIcon}>✅</div>
              <h3>{importedCount} movimientos importados</h3>
              <p>Tus transacciones han sido guardadas exitosamente.</p>
              <button className={styles.doneBtn} onClick={onClose}>Ver mis transacciones</button>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        {(step === 'upload' || step === 'preview') && (
          <div className={styles.footer}>
            <button className={styles.cancelBtn} onClick={step === 'upload' ? onClose : () => setStep('upload')}>
              {step === 'upload' ? 'Cancelar' : '← Volver'}
            </button>
            {step === 'preview' && (
              <button
                className={styles.importBtn}
                onClick={handleConfirmImport}
                disabled={selectedCount === 0 || !selectedAccountId}
              >
                Importar {selectedCount} movimientos →
              </button>
            )}
          </div>
        )}

      </div>
    </div>

    {/* ── Modal Crear Plan MSI ── */}
    {msiTx && <MsiCreateModal tx={msiTx.tx} accounts={accounts} onClose={() => setMsiTx(null)} />}
    </>
  );
}

// ─── Sub-modal para crear un plan MSI ─────────────────────────────────────────

function MsiCreateModal({
  tx,
  accounts,
  onClose,
}: {
  tx: ParsedTransaction;
  accounts: { id: string; name: string; type: string }[];
  onClose: () => void;
}) {
  const [description, setDescription] = useState(tx.description);
  const [totalAmount, setTotalAmount] = useState(String(tx.msiTotalAmount || tx.amount));
  const [months, setMonths] = useState(String(tx.msiTotalMonths || 12));
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState(tx.date.split('T')[0]);
  const [saving, setSaving] = useState(false);

  const creditAccounts = accounts.filter(a => a.type === 'CREDIT');

  const handleCreate = async () => {
    if (!accountId) return alert('Selecciona una tarjeta de crédito');
    setSaving(true);
    try {
      const res = await fetch('/api/msi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: Number(totalAmount),
          months: Number(months),
          accountId,
          description,
          startDate: new Date(startDate).toISOString(),
        }),
      });
      if (res.ok) {
        onClose();
        alert(`✅ Plan MSI creado: ${months} meses de $${(Number(totalAmount) / Number(months)).toFixed(2)}`);
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'No se pudo crear el plan'));
      }
    } finally {
      setSaving(false);
    }
  };

  const monthly = Number(months) > 0 && Number(totalAmount) > 0
    ? (Number(totalAmount) / Number(months)).toFixed(2)
    : null;

  return (
    <div className={styles.msiModalOverlay}>
      <div className={styles.msiModal}>
        <div className={styles.msiModalHeader}>
          <h3 className={styles.msiModalTitle}>🔴 Crear Plan MSI</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className={styles.msiModalHint}>
          🤖 La IA detectó un cargo a meses sin intereses. Revisa los datos y confirma.
        </p>

        <div className={styles.msiFormGroup}>
          <label htmlFor="msi-desc" className={styles.msiLabel}>Descripción</label>
          <input id="msi-desc" title="Descripción" className={styles.msiInput} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className={styles.msiTwoCol}>
          <div className={styles.msiFormGroup}>
            <label htmlFor="msi-amount" className={styles.msiLabel}>Monto total ($)</label>
            <input id="msi-amount" type="number" title="Monto total" className={styles.msiInput} value={totalAmount} onChange={e => setTotalAmount(e.target.value)} min="1" step="0.01" />
          </div>
          <div className={styles.msiFormGroup}>
            <label htmlFor="msi-months" className={styles.msiLabel}>Meses</label>
            <input id="msi-months" type="number" title="Número de meses" className={styles.msiInput} value={months} onChange={e => setMonths(e.target.value)} min="3" max="48" />
          </div>
        </div>
        <div className={styles.msiFormGroup}>
          <label htmlFor="msi-date" className={styles.msiLabel}>Fecha de inicio</label>
          <input id="msi-date" type="date" title="Fecha de inicio" className={styles.msiInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className={styles.msiFormGroup}>
          <label htmlFor="msi-account" className={styles.msiLabel}>Tarjeta de crédito</label>
          <select id="msi-account" title="Tarjeta de crédito" className={styles.msiInput} value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">-- Selecciona tarjeta --</option>
            {creditAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {monthly && (
          <div className={styles.msiSummary}>
            → {months} pagos de ${monthly}/mes
          </div>
        )}

        <div className={styles.msiActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.importBtn} onClick={handleCreate} disabled={saving || !accountId}>
            {saving ? 'Creando...' : '✅ Crear Plan MSI'}
          </button>
        </div>
      </div>
    </div>
  );
}

