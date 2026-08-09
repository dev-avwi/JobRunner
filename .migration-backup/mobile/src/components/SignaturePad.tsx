import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRef, useState } from 'react';
import { useTheme } from '../lib/theme';
import { colors as staticColors } from '../lib/colors';

interface SignaturePadProps {
  onSave: (signatureData: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  label?: string;
  showControls?: boolean;
  existingSignature?: string;
}

const { width: screenWidth } = Dimensions.get('window');

export function SignaturePad({
  onSave,
  onClear,
  width = screenWidth - 64,
  height = 150,
  label = 'Sign Here',
  showControls = true,
  existingSignature,
}: SignaturePadProps) {
  const { isDark, colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [hasSignature, setHasSignature] = useState(!!existingSignature);
  const [signatureData, setSignatureData] = useState<string | null>(existingSignature || null);

  const bgColor = isDark ? '#1f2937' : '#ffffff';
  const strokeColor = isDark ? '#ffffff' : '#1e293b';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const primaryColor = colors.primary;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'signature') {
        setSignatureData(data.data);
        setHasSignature(true);
      } else if (data.type === 'clear') {
        setSignatureData(null);
        setHasSignature(false);
        onClear?.();
      }
    } catch (e) {
      if (__DEV__) console.error('Failed to parse signature message:', e);
    }
  };

  const handleSave = () => {
    if (signatureData) {
      onSave(signatureData);
    }
  };

  const handleClear = () => {
    webViewRef.current?.injectJavaScript('clearCanvas(); true;');
    setSignatureData(null);
    setHasSignature(false);
    onClear?.();
  };

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden;
      touch-action: none;
      background: ${bgColor};
    }
    canvas { 
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
    }
    .placeholder {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #9ca3af;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .placeholder.hidden { opacity: 0; }
  </style>
</head>
<body>
  <div id="placeholder" class="placeholder">${label}</div>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const placeholder = document.getElementById('placeholder');
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let hasContent = false;
    
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '${strokeColor}';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    function getPosition(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    
    function startDrawing(e) {
      e.preventDefault();
      isDrawing = true;
      const pos = getPosition(e);
      lastX = pos.x;
      lastY = pos.y;
      placeholder.classList.add('hidden');
      hasContent = true;
    }
    
    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPosition(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    }
    
    function stopDrawing(e) {
      if (isDrawing && hasContent) {
        isDrawing = false;
        const dataUrl = canvas.toDataURL('image/png');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: dataUrl }));
      }
      isDrawing = false;
    }
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    
    function clearCanvas() {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      hasContent = false;
      placeholder.classList.remove('hidden');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'clear' }));
    }
    
    ${existingSignature ? `
      const img = new Image();
      img.onload = function() {
        const dpr = window.devicePixelRatio || 1;
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
        hasContent = true;
        placeholder.classList.add('hidden');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'signature', data: '${existingSignature}' }));
      };
      img.src = '${existingSignature}';
    ` : ''}
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: isDark ? '#d1d5db' : '#374151' }]}>
        {label}
      </Text>
      <View 
        style={[
          styles.canvasContainer, 
          { 
            width, 
            height,
            borderColor: hasSignature ? primaryColor : borderColor,
            backgroundColor: bgColor,
          }
        ]}
      >
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webView}
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
      
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button, 
              styles.saveButton,
              { backgroundColor: hasSignature ? primaryColor : '#9ca3af' }
            ]}
            onPress={handleSave}
            disabled={!hasSignature}
          >
            <Text style={styles.saveButtonText}>Save Signature</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  canvasContainer: {
    borderWidth: 2,
    borderRadius: 8,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  clearButtonText: {
    color: '#6b7280',
    fontWeight: '500',
  },
  saveButton: {
    flex: 2,
  },
  saveButtonText: {
    color: staticColors.white,
    fontWeight: '600',
  },
});
