
import React, { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

interface MainLayoutProps {
    children: ReactNode;
    currentView: string;
    onNavigate: (view: string) => void;
    title?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    currentView,
    onNavigate,
    title
}) => {
    return (
        <div className="flex h-screen w-full bg-[#0d1017] overflow-hidden">
            {/* Sidebar */}
            <Sidebar currentView={currentView} onNavigate={onNavigate} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col pl-16">
                {/* Navbar */}
                <Navbar title={title} />

                {/* Page Content */}
                <main className="flex-1 mt-14 overflow-auto scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
