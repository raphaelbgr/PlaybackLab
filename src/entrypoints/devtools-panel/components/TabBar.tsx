/**
 * TabBar Component
 * SOLID: Single Responsibility - Tab navigation only
 */

// React not needed with jsx-runtime
import type { AppState } from '../../../store';

interface Tab {
  id: AppState['activeTab'];
  label: string;
}

interface Props {
  activeTab: AppState['activeTab'];
  onTabChange: (tab: AppState['activeTab']) => void;
  tabs: Tab[];
}

export function TabBar({ activeTab, onTabChange, tabs }: Props) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
