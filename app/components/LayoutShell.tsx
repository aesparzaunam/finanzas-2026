import Navbar from './Navbar';
import styles from './layout.module.css';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <Navbar />
            <div className={styles.mainContainer}>
                {/* Sidebar placeholder */}
                <div className={styles.sidebar}>
                    {/* Quick links or filters could go here */}
                    <p className={styles.sidebarMenu}>Menu</p>
                </div>
                <main className={styles.content}>
                    {children}
                </main>
            </div>
        </div>
    );
}
