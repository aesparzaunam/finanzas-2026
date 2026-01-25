'use client';

import { useEffect, useState } from 'react';
import LayoutShell from '../components/dashboard/LayoutShell';
import AccountCard from '../components/accounts/AccountCard';
import styles from '../components/accounts/accounts.module.css';
import dashStyles from '../components/dashboard/dashboard.module.css';

interface Account {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState('BANK');
    const [balance, setBalance] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    async function fetchAccounts() {
        try {
            const res = await fetch('/api/accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
        } catch (error) {
            console.error('Failed to fetch accounts', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, balance }),
            });

            if (res.ok) {
                // Reset form and refresh list
                setName('');
                setType('BANK');
                setBalance('');
                fetchAccounts();
            } else {
                alert('Failed to create account');
            }
        } catch (error) {
            console.error(error);
            alert('Error creating account');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <LayoutShell>
            <h1 className={dashStyles.pageTitle}>Cuentas</h1>

            {/* Create Account Form */}
            <div className={styles.formContainer}>
                <div className={styles.formTitle}>Add New Account</div>
                <form onSubmit={handleCreate}>
                    <div className={styles.formGrid}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Account Name</label>
                            <input
                                className={styles.input}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Chase Checking"
                                required
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Type</label>
                            <select
                                className={styles.select}
                                value={type}
                                onChange={e => setType(e.target.value)}
                            >
                                <option value="BANK">Bank Account</option>
                                <option value="CASH">Cash Wallet</option>
                                <option value="CREDIT">Credit Card</option>
                                <option value="INVESTMENT">Investment</option>
                                <option value="LOAN">Loan</option>
                            </select>
                        </div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Initial Balance</label>
                            <input
                                className={styles.input}
                                type="number"
                                step="0.01"
                                value={balance}
                                onChange={e => setBalance(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className={styles.button} disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Account'}
                    </button>
                </form>
            </div>

            {loading ? (
                <p>Loading accounts...</p>
            ) : (
                <div className={styles.grid}>
                    {accounts.map(acc => (
                        <AccountCard
                            key={acc.id}
                            name={acc.name}
                            type={acc.type}
                            balance={Number(acc.balance)}
                            currency={acc.currency}
                        />
                    ))}
                </div>
            )}
        </LayoutShell>
    );
}
