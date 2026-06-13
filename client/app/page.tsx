'use client';

import { PageLayout } from 'layouts/PageLayout';
import styles from './page.module.css';

export default function Home() {
  return (
    <PageLayout
      render={(user) => (
        <div className={styles.container} data-testid="home-container">
          <div className={styles.title}>Hello {user.displayName}!</div>
          {/* TODO(U6u): 調査一覧・ウィザードへの導線をここに実装 */}
        </div>
      )}
    />
  );
}
