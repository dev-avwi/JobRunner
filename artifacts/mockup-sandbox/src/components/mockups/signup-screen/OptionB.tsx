import React, { useState } from 'react';
import { Hammer, Users, Briefcase, ArrowRight } from 'lucide-react';

export function OptionB() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roles = [
    {
      id: 'owner',
      title: 'I run my own business',
      description: 'Quotes, jobs and getting paid',
      icon: Briefcase,
    },
    {
      id: 'team',
      title: "I'm on a team",
      description: "I've got an invite code from my boss",
      icon: Users,
    },
    {
      id: 'sub',
      title: "I'm a subbie",
      description: "I've got an invite code to join a team",
      icon: Hammer,
    }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white font-sans text-slate-900">
      {/* Left Pane - Bold Brand */}
      <div className="hidden md:flex w-5/12 bg-[#2B7DE9] relative overflow-hidden flex-col justify-center items-center p-12">
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-white blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#F28C28] blur-[120px]" />
        </div>
        
        <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
          <h1 className="text-3xl font-black text-white leading-tight mb-2 tracking-tight">
            Less admin. More tools down.
          </h1>
          <p className="text-blue-100 text-base mb-8 font-medium max-w-sm">
            Built for Aussie tradies to quote, run jobs and get paid.
          </p>

          {/* Real app screenshot in a phone frame */}
          <div className="relative mx-auto w-[235px] transform rotate-[-3deg] hover:rotate-0 transition-transform duration-500">
            <div className="absolute -inset-4 bg-white/20 rounded-[3rem] blur-2xl" />
            <div className="relative bg-white p-2.5 rounded-[2.5rem] shadow-2xl">
              <div className="rounded-[2rem] overflow-hidden aspect-[9/19] bg-white ring-1 ring-black/5">
                <img src="/__mockup/images/dashboard.png" alt="JobRunner dashboard" className="w-full h-full object-cover object-top" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 relative overflow-y-auto">
        <div className="w-full max-w-xl mx-auto">
          {/* Logo */}
          <div className="text-4xl font-black tracking-tighter mb-16">
            <span className="text-[#F28C28]">Job</span>
            <span className="text-[#2B7DE9]">Runner</span>
          </div>

          <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Let's get to work.</h2>
          <p className="text-slate-500 text-lg mb-8 font-medium">How will you be using JobRunner today?</p>

          <div className="space-y-4 mb-10">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full text-left p-6 rounded-2xl border-2 transition-all duration-200 group flex items-start gap-5 ${
                    isSelected 
                      ? 'border-[#2B7DE9] bg-blue-50/50 shadow-sm ring-4 ring-blue-500/10' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-4 rounded-xl flex-shrink-0 transition-all duration-300 ${
                    isSelected ? 'bg-[#2B7DE9] text-white shadow-md shadow-blue-500/20 scale-110' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                  }`}>
                    <Icon size={28} strokeWidth={isSelected ? 2.5 : 2} />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className={`text-xl font-bold mb-1 transition-colors ${isSelected ? 'text-[#2B7DE9]' : 'text-slate-900'}`}>
                      {role.title}
                    </h3>
                    <p className={`text-base transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                      {role.description}
                    </p>
                  </div>
                  
                  {/* Radio indicator */}
                  <div className={`w-6 h-6 rounded-full border-2 mt-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'border-[#2B7DE9]' : 'border-slate-300 group-hover:border-slate-400'
                  }`}>
                    {isSelected && <div className="w-3 h-3 rounded-full bg-[#2B7DE9]" />}
                  </div>
                </button>
              )
            })}
          </div>

          <button 
            disabled={!selectedRole}
            className={`w-full py-5 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
              selectedRole 
                ? 'bg-[#F28C28] hover:bg-[#E57A1F] text-white shadow-xl shadow-orange-500/20 transform hover:-translate-y-0.5' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue
            <ArrowRight size={20} className={selectedRole ? "animate-pulse" : ""} />
          </button>

          <p className="mt-8 text-center text-slate-500 font-medium">
            Already have an account?{' '}
            <button className="text-[#2B7DE9] hover:text-blue-800 font-bold hover:underline transition-colors">
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
