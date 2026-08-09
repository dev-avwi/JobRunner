import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Smartphone, Globe, Apple, Download, Beaker } from "lucide-react";
import logoPath from "@assets/jobrunner-logo-cropped.png";

const APP_STORE_URL = "https://apps.apple.com/app/jobrunner/id6760283858";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.jobrunner.app";

const EXPO_PROJECT_SLUG = "jobrunner";

export default function OpenApp() {
  const [, params] = useRoute("/open-app/:action/:token");
  const [, setLocation] = useLocation();
  const action = params?.action || '';
  const token = params?.token || '';
  
  const [status, setStatus] = useState<'trying' | 'fallback'>('trying');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [showExpoOption, setShowExpoOption] = useState(false);
  
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);
  
  useEffect(() => {
    if (!action || !token) return;
    
    const deepLink = `jobrunner://${action}?token=${token}`;
    const webFallback = `/${action}/${token}`;
    
    if (platform === 'desktop') {
      setLocation(webFallback);
      return;
    }
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = deepLink;
    document.body.appendChild(iframe);
    
    window.location.href = deepLink;
    
    const timeout = setTimeout(() => {
      setStatus('fallback');
      document.body.removeChild(iframe);
    }, 2500);
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timeout);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
  }, [action, token, platform, setLocation]);
  
  const handleOpenStore = () => {
    if (platform === 'ios') {
      window.location.href = APP_STORE_URL;
    } else {
      window.location.href = PLAY_STORE_URL;
    }
  };
  
  const handleContinueWeb = () => {
    setLocation(`/${action}/${token}`);
  };
  
  if (status === 'trying') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #f97316 0%, #2563eb 100%)' }}>
        <div className="w-full max-w-sm text-center">
          <img src={logoPath} alt="JobRunner" className="w-20 h-20 mx-auto mb-6 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-bold text-white mb-2">Opening JobRunner...</h1>
          <p className="text-white/80 text-sm mb-8">
            If the app doesn't open, please wait a moment.
          </p>
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #f97316 0%, #2563eb 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoPath} alt="JobRunner" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg" />
          <h1 className="text-2xl font-bold text-white">Get the JobRunner App</h1>
          <p className="text-white/80 text-sm mt-2">
            For the best experience, download the JobRunner app.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
          <Button 
            className="w-full h-14 text-base gap-3" 
            onClick={handleOpenStore}
          >
            {platform === 'ios' ? (
              <>
                <Apple className="w-6 h-6" />
                Download from App Store
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                Download from Play Store
              </>
            )}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">or</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full h-12 gap-2"
            onClick={handleContinueWeb}
          >
            <Globe className="w-5 h-5" />
            Continue in Browser
          </Button>
        </div>
        
        <p className="text-center text-xs text-white/70 pt-4">
          Already have the app?{' '}
          <button 
            onClick={() => {
              setStatus('trying');
              window.location.href = `jobrunner://${action}?token=${token}`;
            }}
            className="text-white underline font-medium"
          >
            Try opening again
          </button>
        </p>
        
        {!showExpoOption ? (
          <button 
            onClick={() => setShowExpoOption(true)}
            className="text-xs text-white/30 mt-6 block mx-auto"
          >
            Developer options
          </button>
        ) : (
          <div className="mt-4 p-3 bg-white/10 backdrop-blur rounded-lg border border-white/20">
            <p className="text-xs text-white/80 mb-2 flex items-center gap-1.5">
              <Beaker className="w-3.5 h-3.5" />
              <span className="font-medium">Expo Go Testing</span>
            </p>
            <p className="text-xs text-white/70 mb-2">
              Deep links only work with standalone builds. For Expo Go, copy this token and enter it manually in the app:
            </p>
            <code className="text-xs bg-black/20 text-white p-2 rounded block break-all select-all">
              {token}
            </code>
            <p className="text-xs text-white/60 mt-2">
              Or navigate to: <span className="font-mono">/{action}/{token}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
