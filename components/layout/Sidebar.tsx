
import React from 'react';
import { 
  Menu, 
  FileText, 
  Monitor, 
  Code2, 
  Box, 
  Briefcase, 
  Gift, 
  MessageSquare, 
  Users 
} from 'lucide-react';

interface SidebarProps {
  onNavigate: (view: string) => void;
  currentView: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, currentView }) => {
  const menuItems = [
    { icon: Menu, id: 'menu', label: 'Menu' },
    { icon: FileText, id: 'modules', label: 'Modules' },
    { icon: Monitor, id: 'workspace', label: 'Workspace' },
    { icon: Gift, id: 'rewards', label: 'Rewards' },
    { icon: MessageSquare, id: 'chat', label: 'Chat' },
    { icon: Users, id: 'community', label: 'Community' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-[#1a1d21] flex flex-col items-center py-4 z-50 border-r border-gray-800">
      <div className="flex flex-col space-y-6 w-full items-center">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`p-2 rounded-lg transition-all duration-200 group relative
              ${currentView === item.id 
                ? 'text-blue-400 bg-blue-500/10' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            title={item.label}
          >
            <item.icon size={22} strokeWidth={1.5} />
            
            {/* Tooltip */}
            <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-gray-700">
              {item.label}
            </span>
            
            {/* Active Indicator */}
            {currentView === item.id && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-md" />
            )}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
