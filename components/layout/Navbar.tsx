
import React from 'react';
import { ChevronDown, Moon, Sun, User as UserIcon, Trophy, Coins } from 'lucide-react';

interface NavbarProps {
    title?: string;
    workspaceName?: string;
    progress?: number;
}

const Navbar: React.FC<NavbarProps> = ({
    title = "Overview",
    workspaceName = "QMoney",
    progress = 6
}) => {
    return (
        <nav className="h-14 bg-[#1a1d21] border-b border-gray-800 flex items-center justify-between px-4 fixed top-0 left-16 right-0 z-40 text-gray-200">

            {/* Left: Workspace Selector */}
            <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 hover:bg-gray-800 px-3 py-1.5 rounded-md transition-colors">
                    <span className="font-semibold text-white tracking-wide">{workspaceName}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                </button>

                <div className="h-5 w-[1px] bg-gray-700"></div>

                <span className="text-sm font-medium text-gray-300">{title}</span>
            </div>

            {/* Right: Actions & Status */}
            <div className="flex items-center gap-4">

                {/* Portfolio Button */}
                <button className="flex items-center gap-1.5 bg-[#2c3036] hover:bg-[#363a42] text-sm px-3 py-1.5 rounded text-blue-400 border border-transparent hover:border-gray-700 transition-all">
                    <UserIcon size={14} />
                    <span>Portfolio</span>
                </button>

                {/* Coins/Points */}
                <div className="flex items-center gap-1.5 text-yellow-500 font-medium text-sm">
                    <Coins size={16} />
                    <span>0</span>
                </div>

                {/* Theme Toggle */}
                <button className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-800 transition-colors">
                    <Sun size={18} />
                </button>

                {/* Progress */}
                <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
                    <div className="relative w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center bg-gray-800">
                        {/* Simple Avatar Placeholder */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                            alt="User"
                            className="w-6 h-6 rounded-full"
                        />
                    </div>
                    <span className="text-sm font-medium text-gray-300">{progress}% Complete</span>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
