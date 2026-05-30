import React, { useState } from 'react';
import { HardHat, Users, Briefcase, ArrowRight } from 'lucide-react';

export function OptionC() {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roles = [
    {
      id: 'owner',
      title: 'Business Owner',
      description: 'I run my own trade business',
      icon: HardHat,
    },
    {
      id: 'team',
      title: 'Team Member',
      description: "I've got an invite code from my boss",
      icon: Users,
    },
    {
      id: 'subbie',
      title: 'Subcontractor',
      description: "I've got an invite code to join a team",
      icon: Briefcase,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFFBF5] text-[#332A22] font-sans flex flex-col md:flex-row overflow-hidden selection:bg-[#F28C28] selection:text-white">
      {/* Left Column: Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12 z-10 relative">
        <div className="max-w-md mx-auto w-full">
          
          {/* Logo */}
          <div className="mb-12">
            <span className="text-3xl font-extrabold tracking-tight">
              <span className="text-[#F28C28]">Job</span>
              <span className="text-[#2B7DE9]">Runner</span>
            </span>
          </div>

          {/* Headline */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-4 text-[#2E241B] leading-tight">
              Welcome aboard. <br />
              How will you use JobRunner?
            </h1>
            <p className="text-lg text-[#6C5D4F]">
              Let's get your workspace set up perfectly for your needs.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-4 mb-10">
            {roles.map((role) => {
              const isSelected = selectedRole === role.id;
              const Icon = role.icon;
              
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all duration-300 ease-in-out group flex items-center gap-5 ${
                    isSelected
                      ? 'bg-white border-[#F28C28] shadow-[0_8px_30px_rgb(242,140,40,0.15)] transform -translate-y-1'
                      : 'bg-white/60 border-transparent hover:bg-white hover:border-[#F28C28]/30 hover:shadow-md'
                  }`}
                >
                  <div className={`p-4 rounded-2xl transition-colors duration-300 flex-shrink-0 ${
                    isSelected ? 'bg-[#F28C28] text-white' : 'bg-[#F5ECE1] text-[#A68F7B] group-hover:bg-[#F28C28]/10 group-hover:text-[#F28C28]'
                  }`}>
                    <Icon size={28} strokeWidth={2} />
                  </div>
                  <div className="flex-grow">
                    <h3 className={`text-xl font-bold mb-1 transition-colors ${
                      isSelected ? 'text-[#2E241B]' : 'text-[#4A3D30]'
                    }`}>
                      {role.title}
                    </h3>
                    <p className={`text-base transition-colors ${
                      isSelected ? 'text-[#6C5D4F]' : 'text-[#8C7A6B]'
                    }`}>
                      {role.description}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isSelected ? 'bg-[#F28C28] text-white opacity-100 scale-100' : 'bg-transparent text-[#D4C3B3] opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100'
                  }`}>
                    <ArrowRight size={20} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer link */}
          <div className="text-center md:text-left">
            <p className="text-[#6C5D4F] font-medium">
              Already have an account?{' '}
              <a href="#" className="text-[#2B7DE9] hover:text-[#1d63c2] hover:underline underline-offset-4 font-bold transition-colors">
                Log in
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: Visual */}
      <div className="hidden md:flex flex-1 bg-[#F5ECE1] relative items-center justify-center p-12 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#F28C28] rounded-full mix-blend-multiply filter blur-[100px] opacity-10 transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#2B7DE9] rounded-full mix-blend-multiply filter blur-[100px] opacity-10 transform -translate-x-1/3 translate-y-1/3"></div>
        
        {/* Phone Mockup Container */}
        <div className="relative w-full max-w-[340px] z-10 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-700 ease-out">
          <div className="absolute -inset-4 bg-white/40 rounded-[3rem] blur-xl opacity-50"></div>
          <div className="relative bg-white p-3 rounded-[2.5rem] shadow-[0_20px_60px_rgb(0,0,0,0.08)] border border-white/50">
            <div className="rounded-[2rem] overflow-hidden bg-black aspect-[9/19] relative ring-1 ring-black/5">
              <img 
                src="/__mockup/images/dashboard.png" 
                alt="JobRunner Dashboard" 
                className="w-full h-full object-cover"
              />
              
              {/* Fake UI Overlay elements for more depth */}
              <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
              
              {/* Floating notification badge */}
              <div className="absolute top-20 -left-6 bg-white rounded-2xl p-4 shadow-xl border border-black/5 animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#e8f2fc] rounded-full flex items-center justify-center text-[#2B7DE9]">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">New team member</div>
                    <div className="text-xs text-gray-500">Joined 2 mins ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
