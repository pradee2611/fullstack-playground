
import React, { useState } from 'react';
import {
    CheckCircle2,
    Circle,
    Lock,
    Clock,
    Target,
    BookOpen,
    ChevronRight,
    ChevronLeft,
    Play,
    FileText,
    Code
} from 'lucide-react';
import { ProjectModule } from '@/types';

interface ModuleDetailProps {
    module: ProjectModule;
    onStartStep: (stepId: string) => void;
    onBack: () => void;
}

const ModuleDetail: React.FC<ModuleDetailProps> = ({ module, onStartStep, onBack }) => {
    const [activeStepId, setActiveStepId] = useState<string>(module.steps[0].id);

    const activeStep = module.steps.find((s) => s.id === activeStepId) || module.steps[0];

    return (
        <div className="flex h-full w-full bg-[#15191e] text-gray-200">

            {/* Secondary Sidebar (Steps) */}
            <aside className="w-80 flex-shrink-0 bg-[#0d1117] border-r border-gray-800 overflow-y-auto">
                <div className="p-4 border-b border-gray-800">
                    <button
                        onClick={onBack}
                        className="flex items-center text-sm text-gray-400 hover:text-white transition-colors mb-4"
                    >
                        <ChevronLeft size={16} /> Back to Projects
                    </button>
                    <h2 className="font-bold text-lg text-white leading-tight">{module.title}</h2>
                </div>

                <div className="py-2">
                    {module.steps.map((step) => (
                        <button
                            key={step.id}
                            onClick={() => !step.isLocked && setActiveStepId(step.id)}
                            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors relative
                ${activeStepId === step.id ? 'bg-[#1f6feb]/10 border-r-2 border-[#1f6feb]' : 'hover:bg-gray-800'}
                ${step.isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
                        >
                            <div className="mt-0.5">
                                {step.isCompleted ? (
                                    <CheckCircle2 size={16} className="text-green-500" />
                                ) : step.isLocked ? (
                                    <Lock size={16} className="text-gray-500" />
                                ) : (
                                    step.type === 'overview' ? <div className="p-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div></div> :
                                        <Circle size={16} className={activeStepId === step.id ? 'text-blue-400' : 'text-gray-500'} />
                                )}
                            </div>

                            <div className="flex-1">
                                <span className={`text-sm font-medium block ${activeStepId === step.id ? 'text-blue-400' : 'text-gray-300'}`}>
                                    {step.title}
                                </span>
                                {step.type === 'task' && (
                                    <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <BookOpen size={10} /> Module Detail
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 bg-[#0d1017] p-8 overflow-y-auto">

                {/* Top Horizontal Steps/Milestones Scroll */}
                <div className="flex gap-4 overflow-x-auto pb-6 mb-6 scrollbar-thin">
                    <div
                        onClick={() => setActiveStepId('intro')}
                        className={`flex-shrink-0 w-64 h-24 rounded-lg p-4 flex flex-col justify-center relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer shadow-lg
               ${activeStepId === 'intro' ? 'bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-900/20' : 'bg-[#1f242c]'}
             `}
                    >
                        {activeStepId === 'intro' && <div className="absolute right-[-10px] top-[-10px] bg-white/10 w-20 h-20 rounded-full blur-xl"></div>}
                        <h3 className={`font-bold text-xl relative z-10 ${activeStepId === 'intro' ? 'text-white' : 'text-gray-300'}`}>Overview</h3>
                        <div className="absolute bottom-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            <Play size={20} fill="currentColor" />
                        </div>
                    </div>

                    {module.steps.filter(s => s.type !== 'overview').map((step, idx) => (
                        <div
                            key={step.id}
                            onClick={() => !step.isLocked && setActiveStepId(step.id)}
                            className={`flex-shrink-0 w-64 h-24 border rounded-lg p-4 flex flex-col justify-between hover:border-gray-500 transition-colors cursor-pointer
                 ${activeStepId === step.id ? 'bg-[#1c2128] border-blue-500' : 'bg-[#1f242c] border-gray-700'}
                 ${step.isLocked ? 'opacity-50' : ''}
               `}
                        >
                            <div className="flex items-center gap-2">
                                {step.isCompleted ? <CheckCircle2 size={16} className="text-green-500" /> : <Circle size={16} className="text-gray-500" />}
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step {idx + 1}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-200 line-clamp-2">{step.title}</p>
                        </div>
                    ))}
                </div>

                {/* Content Card */}
                <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden shadow-xl mb-24">
                    <div className="p-0">
                        {/* Header */}
                        <div className="bg-[#0070f3] p-6 text-white">
                            <h1 className="text-2xl font-bold mb-4">{activeStep.title}</h1>
                            <p className="text-blue-100 opacity-90 mb-4 text-sm leading-relaxed max-w-3xl">
                                {activeStep.description || "Complete the tasks in this module to proceed."}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {module.techStack?.map((tech) => (
                                    <span key={tech} className="bg-white/20 px-2 py-0.5 rounded text-xs font-semibold backdrop-blur-sm">{tech}</span>
                                ))}
                            </div>

                            <div className="flex items-center gap-6 text-xs font-medium text-blue-100">
                                <div className="flex items-center gap-1.5"><Clock size={14} /> Duration: {module.duration}</div>
                                <div className="flex items-center gap-1.5"><Target size={14} /> Focus: {module.focus}</div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-8">

                            {/* Learning Objectives */}
                            {activeStep.objectives && (
                                <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Target size={20} className="text-blue-400" />
                                        Learning Objectives
                                    </h3>
                                    <ul className="space-y-2">
                                        {activeStep.objectives.map((obj, i) => (
                                            <li key={i} className="flex gap-3 text-gray-300 text-sm">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                                                {obj}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Study Content */}
                            {activeStep.studyContent && activeStep.studyContent.length > 0 && (
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <BookOpen size={24} className="text-green-400" />
                                        Study Material
                                    </h3>
                                    <div className="grid gap-6">
                                        {activeStep.studyContent.map((content) => (
                                            <div key={content.id} className="bg-[#0d1117] border border-gray-700 rounded-lg p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h4 className="text-lg font-medium text-white">{content.title}</h4>
                                                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                                                        {content.duration}
                                                    </span>
                                                </div>
                                                {content.content && (
                                                    <div
                                                        className="prose prose-invert prose-sm max-w-none text-gray-300"
                                                        dangerouslySetInnerHTML={{ __html: content.content }}
                                                    />
                                                )}
                                                {content.url && (
                                                    <a
                                                        href={content.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mt-4 text-sm font-medium"
                                                    >
                                                        Read Documentation <ChevronRight size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Assessment / Task */}
                            {activeStep.task && (
                                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 ring-1 ring-blue-500/20">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Code size={24} className="text-blue-400" />
                                            Coding Assessment
                                        </h3>
                                        <button
                                            onClick={() => onStartStep(activeStep.id)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all hover:scale-105"
                                        >
                                            Open Workspace <ChevronRight size={16} />
                                        </button>
                                    </div>

                                    <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-6 mb-6">
                                        <h4 className="font-semibold text-white mb-2">{activeStep.task.title}</h4>
                                        <p className="text-gray-300 text-sm mb-4">{activeStep.task.description}</p>

                                        {activeStep.task.acceptanceCriteria && (
                                            <div className="mt-4">
                                                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Acceptance Criteria</h5>
                                                <ul className="space-y-2">
                                                    {activeStep.task.acceptanceCriteria.map((criteria, i) => (
                                                        <li key={i} className="flex gap-2 text-sm text-gray-300">
                                                            <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                                                            {criteria}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* Floating Action Bar - Context Aware */}
                <div className="fixed bottom-6 right-8 left-80 ml-16 flex justify-end pointer-events-none">
                    <div className="pointer-events-auto flex gap-4">
                        {activeStep.task && (
                            <button
                                onClick={() => onStartStep(activeStep.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full font-bold shadow-xl shadow-green-900/30 flex items-center gap-2 transform hover:-translate-y-1 transition-all"
                            >
                                <Code size={20} /> Start Coding
                            </button>
                        )}

                        {/* Next Step Navigation helper */}
                        {!activeStep.task && (
                            <button
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold shadow-xl shadow-blue-900/30 flex items-center gap-2 transform hover:-translate-y-1 transition-all"
                                onClick={() => {
                                    const idx = module.steps.findIndex(s => s.id === activeStepId);
                                    if (idx < module.steps.length - 1) {
                                        setActiveStepId(module.steps[idx + 1].id);
                                    }
                                }}
                            >
                                Next Step <ChevronRight size={20} />
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ModuleDetail;
