import React, { useState } from "react";
import { Briefcase, Users, HardHat, ChevronRight } from "lucide-react";

export function OptionA() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roles = [
    {
      id: "owner",
      title: "Business Owner",
      description: "I run my own trade business",
      icon: Briefcase,
    },
    {
      id: "team",
      title: "Team Member",
      description: "I've got an invite code from my boss",
      icon: Users,
    },
    {
      id: "sub",
      title: "Subcontractor",
      description: "I've got an invite code to join a team",
      icon: HardHat,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-[#F28C28]">Job</span>
            <span className="text-[#2B7DE9]">Runner</span>
          </h1>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-slate-900 mb-3">
            How will you use JobRunner?
          </h2>
          <p className="text-slate-500 text-lg font-light">
            Choose your role to customize your experience.
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-12">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`w-full group text-left p-6 rounded-2xl border transition-all duration-300 ease-out flex items-center gap-5
                  ${isSelected 
                    ? "border-[#2B7DE9] bg-blue-50/50 shadow-sm ring-1 ring-[#2B7DE9]/20" 
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm hover:bg-slate-50/50"
                  }
                `}
              >
                <div className={`p-3 rounded-xl transition-colors duration-300
                  ${isSelected ? "bg-white text-[#2B7DE9] shadow-sm" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700 group-hover:shadow-sm"}
                `}>
                  <Icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-medium mb-1 transition-colors duration-300 ${isSelected ? "text-[#2B7DE9]" : "text-slate-900"}`}>
                    {role.title}
                  </h3>
                  <p className="text-slate-500 font-light text-sm">
                    {role.description}
                  </p>
                </div>
                <div className={`transition-all duration-300 ${isSelected ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0"}`}>
                  <ChevronRight className={`w-5 h-5 ${isSelected ? "text-[#2B7DE9]" : "text-slate-400"}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col items-center gap-6">
          <button 
            disabled={!selectedRole}
            className={`w-full py-4 px-6 rounded-xl text-white font-medium text-lg transition-all duration-300
              ${selectedRole 
                ? "bg-[#2B7DE9] hover:bg-blue-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5" 
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }
            `}
          >
            Continue
          </button>
          
          <a href="#" className="text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
            Already have an account? Log in
          </a>
        </div>

      </div>
    </div>
  );
}
