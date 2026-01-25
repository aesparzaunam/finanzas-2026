import Link from 'next/link';
import styles from './layout.module.css';

export default function Navbar() {
    return (
        <nav className={styles.navbar}>
            <Link href="/" className={styles.logo}>
                Finanzas 2026
            </Link>
            <div className={styles.navLinks}>
                <Link href="/" className={styles.navLink}>Dashboard</Link>
                <Link href="/accounts" className={styles.navLink}>Accounts</Link>
                <Link href="/transactions" className={styles.navLink}>Transactions</Link>
                <Link href="/reports" className={styles.navLink}>Reports</Link>
            </div>
        </nav>
    );
}
