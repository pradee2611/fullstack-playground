
import React from 'react';
import { Plus, FolderGit2, Star, Clock, BarChart3, ChevronRight } from 'lucide-react';
import { SAMPLE_MODULES } from '@/data/modules';

interface ModuleListProps {
    onSelectModule: (moduleId: string) => void;
    onCreateNew: () => void;
}

const ModuleList: React.FC<ModuleListProps> = ({ onSelectModule, onCreateNew }) => {
    return (
        <div className="p-8 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-end mb-10 border-b border-gray-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Available Modules</h1>
                    <p className="text-gray-400">Select a project to start building or create your own custom workspace.</p>
                </div>
                <button
                    onClick={onCreateNew}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
                >
                    <Plus size={18} />
                    Create New Project
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SAMPLE_MODULES.map((project) => (
                    <div
                        key={project.id}
                        onClick={() => onSelectModule(project.id)}
                        className="group bg-[#161b22] border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 hover:bg-[#1c2128] transition-all cursor-pointer flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="text-blue-500" />
                        </div>

                        <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                            <FolderGit2 size={24} />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{project.title}</h3>
                        <p className="text-gray-400 text-sm mb-6 flex-grow line-clamp-2">{project.description}</p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                                <span className="flex items-center gap-1.5"><BarChart3 size={14} /> {project.level}</span>
                                <span className="flex items-center gap-1.5"><Clock size={14} /> {project.duration}</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {project.techStack.map((tech) => (
                                    <span key={tech} className="bg-[#0d1117] border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between text-sm">
                            <span className="text-green-500 flex items-center gap-1.5 font-medium"><Star size={14} fill="currentColor" /> Premium</span>
                            <span className="text-blue-400 font-medium group-hover:underline">Start Building</span>
                        </div>
                    </div>
                ))}

                {/* Create New Placeholder Card */}
                <div
                    onClick={onCreateNew}
                    className="border border-dashed border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-500/5 transition-all cursor-pointer min-h-[300px]"
                >
                    <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-blue-400">
                        <Plus size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Build from Scratch</h3>
                    <p className="text-gray-500 text-sm max-w-[200px]">Have a unique idea? Set up a custom environment for your use case.</p>
                </div>
            </div>
        </div>
    );
};

export default ModuleList;
